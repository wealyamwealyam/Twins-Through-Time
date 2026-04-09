import json
import os
import re
from typing import Any, Callable

import torch
import transformers
from dotenv import load_dotenv

load_dotenv()

# get the current user's hugging face token from the .env file
HF_TOKEN = os.getenv("HF_TOKEN")
if HF_TOKEN is None:
    raise RuntimeError("HF_TOKEN not found. You need to create a .env file with your HF_TOKEN in it.")

# Use Llama 3.2
MODEL_ID = "meta-llama/Llama-3.2-3B-Instruct"

# create the pipeline with transformers. give it my hugging face token.
pipeline = transformers.pipeline(
    "text-generation",
    model=MODEL_ID,
    token=HF_TOKEN,
    device_map="cpu",
    torch_dtype=torch.float32,
)

LogFn = Callable[[str], None]


# Run the LLM. Give it the messages array and then return the generated content
def run_llm(messages, maxTokens=256, log_fn: LogFn | None = None):
    if log_fn:
        log_fn(f"Running LLM inference (maxTokens={maxTokens})")
    outputs = pipeline(
        messages,
        max_new_tokens=maxTokens,
    )
    return outputs[0]["generated_text"][-1]["content"]


# The format of the JSON I want as output
jsonFormat = {
    "First Name": "value",
    "Middle Name or Initial": "value",
    "Last Name": "value",
    "Military Unit": "value",
    "Regiment Number": "value",
    "Regiment State": "value",
    "Branch": "value",
    "Company": "value",
    "Age": 0,
    "Year Born": 0,
    "Transcript": "value",
    "Confidence": 0.0,
    "Source": "https://example.com/source-page",
    "Other": {
        "other1": "value",
        "other2": "value",
    }
}


# The key of the json so the LLM knows what each key means.
jsonKey = {
    "First Name": "The first name of the soldier.",
    "Middle Name or Initial": "The middle name or middle initial of the soldier.",
    "Last Name": "The last name of the soldier.",
    "Military Unit": "The military unit the soldier served in. The full unit name.",
    "Regiment Number": "The regiment number part of the military unit.",
    "Regiment State": "The regiment state part of the military unit.",
    "Branch": "The branch of the military unit.",
    "Company": "The company (regiment subunit) of the military unit.",
    "Age": "The age of the soldier at the time described, if known.",
    "Year Born": "The year the soldier was born, if known.",
    "Transcript": "Any writing that was found on the physical photo.",
    "Confidence": "Numeric confidence from 0.0 to 1.0 (downstream scoring may override this value).",
    "Source": "The page URL where this image record was found.",
    "Other": {
        "": "Any other useful fact. Replace the key with a descriptive key.",
        "": "Facts in Other should be short and specific, not long paragraphs.",
    }
}


SYSTEM_PROMPT = (
    "You are a Civil War soldier metadata extractor. "
    "Given source text, return ONLY one JSON object and nothing else. "
    "Use this exact top-level schema and keys: "
    f"{jsonFormat}. "
    "Use these key definitions: "
    f"{jsonKey}. "
    "Rules: "
    "(1) If unknown, set value to null except Confidence and Source. "
    "(2) Age and Year Born must be integers or null. "
    "(3) Confidence must be a number from 0.0 to 1.0. "
    "(4) Source must be a URL string (or empty string if unavailable). "
    "(5) Other must be a JSON object of short key-value facts. "
    "(6) Do not add or remove top-level keys."
)


def build_metadata_messages(document_text: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": document_text},
    ]


def _default_metadata() -> dict[str, Any]:
    return {
        "First Name": None,
        "Middle Name or Initial": None,
        "Last Name": None,
        "Military Unit": None,
        "Age": None,
        "Year Born": None,
        "Confidence": 0.0,
        "Source": "",
        "Other": {},
    }


def _to_int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        match = re.search(r"-?\d+", value)
        if match:
            try:
                return int(match.group(0))
            except ValueError:
                return None
    return None


def _to_confidence(value: Any) -> float:
    confidence = 0.0

    if isinstance(value, (int, float)):
        confidence = float(value)
    elif isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        if match:
            try:
                confidence = float(match.group(0))
            except ValueError:
                confidence = 0.0

    # If model returned percentage-style values (for example 82), normalize.
    if confidence > 1.0 and confidence <= 100.0:
        confidence = confidence / 100.0

    if confidence < 0.0:
        confidence = 0.0
    if confidence > 1.0:
        confidence = 1.0

    return round(confidence, 4)


def _normalize_match_text(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", str(text).lower())
    return re.sub(r"\s+", " ", normalized).strip()


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _value_supported_in_text(value: Any, normalized_doc: str) -> bool:
    if not _has_value(value):
        return False

    normalized_value = _normalize_match_text(str(value))
    if not normalized_value:
        return False

    return f" {normalized_value} " in f" {normalized_doc} "


def _rule_based_confidence(metadata: dict[str, Any], document_text: str) -> float:
    normalized_doc = _normalize_match_text(document_text)

    points = 0.0
    max_points = 126.0

    # Presence + direct textual support weights.
    field_weights = {
        "First Name": (12.0, 10.0),
        "Middle Name or Initial": (3.0, 2.0),
        "Last Name": (12.0, 10.0),
        "Military Unit": (14.0, 12.0),
        "Age": (6.0, 6.0),
        "Year Born": (6.0, 6.0),
    }

    supports: dict[str, bool] = {}

    for field, (presence_weight, support_weight) in field_weights.items():
        value = metadata.get(field)
        if _has_value(value):
            points += presence_weight
        supported = _value_supported_in_text(value, normalized_doc)
        supports[field] = supported
        if supported:
            points += support_weight

    other = metadata.get("Other")
    if isinstance(other, dict) and other:
        bonus = 0.0
        for key, value in other.items():
            if not _has_value(key) or not _has_value(value):
                continue
            bonus += 2.0
            if _value_supported_in_text(value, normalized_doc):
                bonus += 1.0
        points += min(10.0, bonus)

    core_fields = ("First Name", "Last Name", "Military Unit")
    if all(_has_value(metadata.get(name)) for name in core_fields):
        points += 5.0
    if all(supports.get(name, False) for name in core_fields):
        points += 8.0

    if supports.get("Age") or supports.get("Year Born"):
        points += 4.0

    confidence = points / max_points
    if confidence < 0.0:
        confidence = 0.0
    if confidence > 1.0:
        confidence = 1.0
    return round(confidence, 4)


def _finalize_confidence(metadata: dict[str, Any], document_text: str) -> dict[str, Any]:
    rule_conf = _rule_based_confidence(metadata, document_text)
    llm_conf = _to_confidence(metadata.get("Confidence"))

    # Primarily deterministic confidence from extraction quality + textual support.
    # Keep only a small LLM influence when non-zero.
    if llm_conf > 0:
        confidence = (0.9 * rule_conf) + (0.1 * llm_conf)
    else:
        confidence = rule_conf

    metadata["Confidence"] = round(min(1.0, max(0.0, confidence)), 4)
    return metadata


def normalize_metadata_schema(candidate: Any) -> dict[str, Any]:
    result = _default_metadata()
    if not isinstance(candidate, dict):
        return result

    result["First Name"] = candidate.get("First Name") if candidate.get("First Name") not in ("",) else None
    result["Middle Name or Initial"] = (
        candidate.get("Middle Name or Initial") if candidate.get("Middle Name or Initial") not in ("",) else None
    )
    result["Last Name"] = candidate.get("Last Name") if candidate.get("Last Name") not in ("",) else None
    result["Military Unit"] = candidate.get("Military Unit") if candidate.get("Military Unit") not in ("",) else None
    result["Age"] = _to_int_or_none(candidate.get("Age"))
    result["Year Born"] = _to_int_or_none(candidate.get("Year Born"))
    result["Confidence"] = _to_confidence(candidate.get("Confidence"))

    source = candidate.get("Source")
    result["Source"] = str(source).strip() if source is not None else ""

    other = candidate.get("Other")
    if isinstance(other, dict):
        cleaned_other: dict[str, str] = {}
        for k, v in other.items():
            key = str(k).strip()
            value = str(v).strip() if v is not None else ""
            if key and value:
                cleaned_other[key] = value
        result["Other"] = cleaned_other
    else:
        result["Other"] = {}

    return result


def _extract_first_json_block(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def extract_metadata(document_text: str, maxTokens: int = 350, log_fn: LogFn | None = None) -> dict[str, Any]:
    if log_fn:
        log_fn("Building metadata extraction prompt")

    messages = build_metadata_messages(document_text)

    try:
        response = run_llm(messages, maxTokens=maxTokens, log_fn=log_fn)
    except Exception as exc:
        if log_fn:
            log_fn(f"LLM runtime error: {exc}")
        return _default_metadata()

    if isinstance(response, dict):
        if log_fn:
            log_fn("LLM returned dict output directly")
        normalized = normalize_metadata_schema(response)
        return _finalize_confidence(normalized, document_text)

    response_text = str(response).strip()
    json_text = _extract_first_json_block(response_text)
    if json_text is None:
        if log_fn:
            log_fn("LLM output did not contain a JSON object; using defaults")
        return _default_metadata()

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError as exc:
        if log_fn:
            log_fn(f"Failed to parse LLM JSON output: {exc}")
        return _default_metadata()

    normalized = normalize_metadata_schema(parsed)
    return _finalize_confidence(normalized, document_text)


if __name__ == "__main__":
    sample_document = (
        "Major Frank Biddle Ward, 15th Pennsylvania Cavalry. "
        "At the onset of the war, 19 year old Frank Biddle Ward enlisted in the Duquesne Grays. "
        "Ward advanced through the ranks to Junior Major, 15th Pennsylvania Cavalry."
    )

    metadata = extract_metadata(sample_document)
    print(type(metadata))

    with open("llm_output.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

import json
import os
import re
from typing import Any

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


# Run the LLM. Give it the messages array and then return the generated content
def run_llm(messages, maxTokens=256):
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
    "Age": 0,
    "Year Born": 0,
    "Other": {
        "other1": "value",
        "other2": "value",
    },
}


# The key of the json so the LLM knows what each key means.
jsonKey = {
    "First Name": "The first name of the soldier.",
    "Middle Name or Initial": "The middle name or middle initial of the soldier.",
    "Last Name": "The last name of the soldier.",
    "Military Unit": "The military unit the soldier served in.",
    "Age": "The age of the soldier at the time described, if known.",
    "Year Born": "The year the soldier was born, if known.",
    "Other": {
        "": "Any other useful fact. Replace the key with a descriptive key.",
        "": "Facts in Other should be short and specific, not long paragraphs.",
    },
}


SYSTEM_PROMPT = (
    "You are a Civil War soldier metadata extractor. "
    "Given source text, return ONLY one JSON object and nothing else. "
    "Use this exact top-level schema and keys: "
    f"{jsonFormat}. "
    "Use these key definitions: "
    f"{jsonKey}. "
    "Rules: "
    "(1) If unknown, set value to null. "
    "(2) Age and Year Born must be integers or null. "
    "(3) Other must be a JSON object of short key-value facts. "
    "(4) Do not add or remove top-level keys."
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


def extract_metadata(document_text: str, maxTokens: int = 350) -> dict[str, Any]:
    messages = build_metadata_messages(document_text)
    response = run_llm(messages, maxTokens=maxTokens)

    if isinstance(response, dict):
        return normalize_metadata_schema(response)

    response_text = str(response).strip()
    json_text = _extract_first_json_block(response_text)
    if json_text is None:
        return _default_metadata()

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        return _default_metadata()

    return normalize_metadata_schema(parsed)


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

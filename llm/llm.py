import json
import os
import re
from typing import Any, Callable

try:
    from groq import Groq
except ImportError:
    Groq = None
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Load from llm/.env first, then fall back to project root .env
_this_dir = os.path.dirname(os.path.abspath(__file__))
if load_dotenv is not None:
    load_dotenv(os.path.join(_this_dir, ".env"))
    load_dotenv()  # fallback to cwd .env
else:
    # Keep the scraper usable on machines that have transformers/torch installed
    # but not python-dotenv. This supports the simple KEY=value lines used here.
    for env_path in (os.path.join(_this_dir, ".env"), os.path.join(os.getcwd(), ".env")):
        if not os.path.exists(env_path):
            continue
        with open(env_path, "r", encoding="utf-8") as env_file:
            for line in env_file:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

# Hosted LLM path. When this is set, the scraper avoids local CPU inference.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
groq_client = None

# get the current user's hugging face token from the .env file
HF_TOKEN = os.getenv("HF_TOKEN")

# Default to a small ungated model so local CPU scraping can finish.
# Set LLM_MODEL_ID in llm/.env if you want a larger Hugging Face model.
_PRIMARY_MODEL   = "HuggingFaceTB/SmolLM2-135M-Instruct"
_FALLBACK_MODEL  = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_ID = os.getenv("LLM_MODEL_ID", _PRIMARY_MODEL)
pipeline = None

def _load_pipeline():
    """Try primary model; fall back to ungated model if gated access is denied."""
    if HF_TOKEN is None:
        raise RuntimeError(
            "HF_TOKEN not found. Set GROQ_API_KEY for hosted inference, "
            "or set HF_TOKEN to use the local Hugging Face fallback."
        )

    try:
        import torch
        import transformers
    except ImportError as exc:
        raise RuntimeError(
            "Local Hugging Face fallback requires torch and transformers. "
            "Install them with: pip install -r llm/requirements-local-fallback.txt"
        ) from exc

    for model in [MODEL_ID, _FALLBACK_MODEL] if MODEL_ID == _PRIMARY_MODEL else [MODEL_ID]:
        try:
            print(f"[llm] Loading model: {model}", flush=True)
            p = transformers.pipeline(
                "text-generation",
                model=model,
                token=HF_TOKEN,
                device_map="cpu",
                torch_dtype=torch.float32,
            )

            tokenizer = getattr(p, "tokenizer", None)
            if tokenizer is not None and getattr(tokenizer, "pad_token_id", None) is None:
                eos_id = getattr(tokenizer, "eos_token_id", None)
                unk_id = getattr(tokenizer, "unk_token_id", None)
                if eos_id is not None:
                    tokenizer.pad_token_id = eos_id
                elif unk_id is not None:
                    tokenizer.pad_token_id = unk_id

            print(f"[llm] Loaded: {model}", flush=True)
            return p, model
        except Exception as e:
            if "gated" in str(e).lower() or "403" in str(e) or "401" in str(e):
                print(f"[llm] {model} is gated / unauthorised; trying fallback.", flush=True)
                if model == _FALLBACK_MODEL:
                    raise
            else:
                raise
    raise RuntimeError("Could not load any LLM model.")

def _get_pipeline():
    global pipeline, MODEL_ID
    if pipeline is None:
        pipeline, MODEL_ID = _load_pipeline()
    return pipeline

def _get_groq_client():
    global groq_client
    if not GROQ_API_KEY:
        return None
    if Groq is None:
        raise RuntimeError("GROQ_API_KEY is set, but the Python 'groq' package is not installed. Run: pip install groq")
    if groq_client is None:
        groq_client = Groq(api_key=GROQ_API_KEY)
    return groq_client

LogFn = Callable[[str], None]
NULL_LIKE_STRINGS = {"null", "none", "unknown", "no value provided", "n/a"}


STATE_NAME_TO_ABBREV = {
    "ALABAMA": "AL",
    "ALASKA": "AK",
    "ARIZONA": "AZ",
    "ARKANSAS": "AR",
    "CALIFORNIA": "CA",
    "COLORADO": "CO",
    "CONNECTICUT": "CT",
    "DELAWARE": "DE",
    "DISTRICT OF COLUMBIA": "DC",
    "FLORIDA": "FL",
    "GEORGIA": "GA",
    "HAWAII": "HI",
    "IDAHO": "ID",
    "ILLINOIS": "IL",
    "INDIANA": "IN",
    "IOWA": "IA",
    "KANSAS": "KS",
    "KENTUCKY": "KY",
    "LOUISIANA": "LA",
    "MAINE": "ME",
    "MARYLAND": "MD",
    "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI",
    "MINNESOTA": "MN",
    "MISSISSIPPI": "MS",
    "MISSOURI": "MO",
    "MONTANA": "MT",
    "NEBRASKA": "NE",
    "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    "OHIO": "OH",
    "OKLAHOMA": "OK",
    "OREGON": "OR",
    "PENNSYLVANIA": "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN",
    "TEXAS": "TX",
    "UTAH": "UT",
    "VERMONT": "VT",
    "VIRGINIA": "VA",
    "WASHINGTON": "WA",
    "WEST VIRGINIA": "WV",
    "WISCONSIN": "WI",
    "WYOMING": "WY",
}
ABBREV_TO_STATE_NAME = {abbr: name for name, abbr in STATE_NAME_TO_ABBREV.items()}


# Run the LLM. Give it the messages array and then return the generated content
def run_llm(messages, maxTokens=256, log_fn: LogFn | None = None):
    groq = _get_groq_client()
    if groq is not None:
        if log_fn:
            log_fn(f"Running Groq hosted inference model={GROQ_MODEL} maxTokens={maxTokens}")

        try:
            completion = groq.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=maxTokens,
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            return completion.choices[0].message.content or ""
        except Exception as exc:
            if log_fn:
                log_fn(f"Groq inference failed; falling back to local Hugging Face: {exc}")

    if log_fn:
        log_fn(f"Running local Hugging Face inference (maxTokens={maxTokens})")

    text_pipeline = _get_pipeline()
    outputs = text_pipeline(
        messages,
        max_new_tokens=maxTokens,
        do_sample=False,
        temperature=None,
        top_p=None,
        pad_token_id=getattr(getattr(text_pipeline, "tokenizer", None), "pad_token_id", None),
    )
    return outputs[0]["generated_text"][-1]["content"]


# The format of the JSON I want as output
jsonFormat = {
    "First Name": "value",
    "Middle Name or Initial": "value",
    "Last Name": "value",
    "Military Unit": "value",
    "Regiment Number": 0,
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
    },
}


# The key of the json so the LLM knows what each key means.
jsonKey = {
    "First Name": "The first name of the soldier.",
    "Middle Name or Initial": "The middle name or middle initial of the soldier.",
    "Last Name": "The last name of the soldier.",
    "Military Unit": "The military unit the soldier served in. The full unit name.",
    "Regiment Number": "The regiment number part of the military unit (integer).",
    "Regiment State": "The regiment state part of the military unit using two-letter USPS abbreviation.",
    "Branch": "The branch of the military unit. (Army, Navy, Infantry, etc.)",
    "Company": "The company (regiment subunit) of the military unit.",
    "Age": "The age of the soldier at the time described, if known.",
    "Year Born": "The year the soldier was born, if known.",
    "Transcript": "Any writing that was found on the physical photo.",
    "Confidence": "Numeric confidence from 0.0 to 1.0 (downstream scoring may override this value).",
    "Source": "The page URL where this image record was found.",
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
    "(1) If unknown, set value to null except Confidence and Source. "
    "(2) Age, Year Born, and Regiment Number must be integers or null. "
    "(3) Regiment State must be a 2-letter uppercase abbreviation (for example PA). "
    "(4) Branch, Company, and Transcript must be strings when known. "
    "(5) Confidence must be a number from 0.0 to 1.0. "
    "(6) Source must be a URL string (or empty string if unavailable). "
    "(7) Other must be a JSON object of short key-value facts. "
    "(8) Do not add or remove top-level keys."
)


NON_CONTENTDM_SYSTEM_PROMPT = (
    "You extract metadata for one specific image from a non-CONTENTdm article/blog page. "
    "The page may describe multiple people, so prioritize evidence in this order: "
    "Image Caption, Image Alt Text, Nearby Paragraphs, Local Heading, then Article Summary. "
    "Do not copy a person from article summary when caption/alt point to a different person. "
    "If caption or nearby text contains a military unit phrase, copy that exact phrase into Military Unit. "
    "If identity is ambiguous, leave uncertain fields null and explain ambiguity in Other. "
    "Return ONLY one JSON object with these exact top-level keys: "
    "First Name, Middle Name or Initial, Last Name, Military Unit, Regiment Number, "
    "Regiment State, Branch, Company, Age, Year Born, Transcript, Confidence, Source, Other. "
    "Rules: "
    "(1) Unknown values -> null, except Confidence (0.0-1.0 number) and Source (URL string). "
    "(2) Regiment Number, Age, and Year Born must be integers or null. "
    "(3) Regiment State must be two-letter uppercase abbreviation. "
    "(4) Branch, Company, and Transcript must be strings when known. "
    "(5) Other must be a short key-value object. "
    "(6) Do not add or remove top-level keys."
)

def build_metadata_messages(document_text: str, system_prompt: str | None = None) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt or SYSTEM_PROMPT},
        {"role": "user", "content": document_text},
    ]


def _default_metadata() -> dict[str, Any]:
    return {
        "First Name": None,
        "Middle Name or Initial": None,
        "Last Name": None,
        "Military Unit": None,
        "Regiment Number": None,
        "Regiment State": "",
        "Branch": "",
        "Company": "",
        "Age": None,
        "Year Born": None,
        "Transcript": "",
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


def _to_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    if text.lower() in NULL_LIKE_STRINGS:
        return default
    return text if text else default


def _to_string_or_none(value: Any) -> str | None:
    text = _to_string(value, default="")
    return text if text else None


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


def _normalize_state_abbrev(value: Any) -> str:
    text = _to_string(value)
    if not text:
        return ""

    cleaned = re.sub(r"[\.,]", "", text).strip().upper()
    if cleaned in ABBREV_TO_STATE_NAME:
        return cleaned

    if cleaned in STATE_NAME_TO_ABBREV:
        return STATE_NAME_TO_ABBREV[cleaned]

    for state_name, state_abbrev in STATE_NAME_TO_ABBREV.items():
        if re.search(rf"\b{re.escape(state_name)}\b", cleaned):
            return state_abbrev

    if len(cleaned) == 2 and cleaned.isalpha():
        return cleaned

    return ""


def _infer_regiment_number_from_unit(military_unit: str | None) -> int | None:
    if not military_unit:
        return None
    match = re.search(r"\b(\d{1,4})(?:st|nd|rd|th)?\b", military_unit, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _infer_regiment_state_from_unit(military_unit: str | None) -> str:
    if not military_unit:
        return ""
    upper = re.sub(r"[\.,]", "", military_unit).upper()
    for state_name, state_abbrev in STATE_NAME_TO_ABBREV.items():
        if re.search(rf"\b{re.escape(state_name)}\b", upper):
            return state_abbrev
    for abbr in ABBREV_TO_STATE_NAME:
        if re.search(rf"\b{re.escape(abbr)}\b", upper):
            return abbr
    return ""


def _clean_branch_text(branch_text: str) -> str:
    cleaned = re.sub(r"\s+", " ", branch_text).strip(" .,:;_-")
    cleaned = re.sub(r"^(?:branch|service)\s*[:=-]\s*", "", cleaned, flags=re.IGNORECASE)
    if not cleaned:
        return ""
    # Keep user-friendly casing for all-uppercase/all-lowercase extractions.
    if cleaned.isupper() or cleaned.islower():
        return cleaned.title()
    return cleaned


def _infer_branch_from_unit(military_unit: str | None) -> str:
    if not military_unit:
        return ""

    unit = re.sub(r"\s+", " ", military_unit).strip()

    # Common archive pattern:
    # "United States. Army. Illinois Cavalry Regiment, 4th ..."
    segments = [seg.strip(" .,:;_-") for seg in re.split(r"[.;]", unit) if seg.strip()]
    if len(segments) >= 2:
        for i in range(len(segments) - 1):
            left = segments[i]
            right = segments[i + 1]
            if re.search(r"\b(united|confederate|states?|republic|kingdom|empire|nation)\b", left, re.IGNORECASE):
                candidate = _clean_branch_text(right)
                if candidate:
                    # Avoid returning obvious unit-level strings as the branch.
                    if not re.search(
                        r"\b(regiment|company|battalion|brigade|division|corps|squadron|detachment|unit)\b",
                        candidate,
                        re.IGNORECASE,
                    ):
                        return candidate

    # Generic pattern where a service is named directly after country/entity marker.
    match = re.search(
        r"(?:United\s+States|U\.?\s*S\.?|Confederate\s+States(?:\s+of\s+America)?)"
        r"[\s\.,-]+([A-Za-z][A-Za-z &\-/]{1,40})",
        unit,
        flags=re.IGNORECASE,
    )
    if match:
        candidate = _clean_branch_text(match.group(1))
        if candidate:
            candidate = re.split(r"[,()]", candidate)[0].strip()
            if not re.search(
                r"\b(regiment|company|battalion|brigade|division|corps|squadron|detachment|unit)\b",
                candidate,
                re.IGNORECASE,
            ):
                return candidate

    # If only a unit-type phrase is present, use the most branch-like tail token.
    match = re.search(r"\b([A-Za-z][A-Za-z &\-/]{1,60})\s+Regiment\b", unit, flags=re.IGNORECASE)
    if match:
        phrase = re.sub(r"\s+", " ", match.group(1)).strip()
        tokens = phrase.split()
        if tokens:
            candidate = _clean_branch_text(tokens[-1])
            if candidate:
                return candidate

    return ""


def _normalize_company(value: Any) -> str:
    text = _to_string(value)
    if not text:
        return ""

    # Normalize common forms: "co. c" -> "Company C", "C" -> "Company C"
    compact = re.sub(r"\s+", " ", text).strip()
    match = re.match(r"^(?:co\.?|company)\s*([a-z])$", compact, flags=re.IGNORECASE)
    if match:
        return f"Company {match.group(1).upper()}"
    if re.match(r"^[a-z]$", compact, flags=re.IGNORECASE):
        return f"Company {compact.upper()}"
    return compact


def _value_supported_in_text(field_name: str, value: Any, normalized_doc: str) -> bool:
    if not _has_value(value):
        return False

    if field_name == "Regiment State":
        state_abbrev = _normalize_state_abbrev(value)
        if not state_abbrev:
            return False
        state_name = ABBREV_TO_STATE_NAME.get(state_abbrev, "")
        tokens = [state_abbrev.lower()]
        if state_name:
            tokens.append(state_name.lower())
        return any(f" {token} " in f" {normalized_doc} " for token in tokens)

    normalized_value = _normalize_match_text(str(value))
    if not normalized_value:
        return False

    return f" {normalized_value} " in f" {normalized_doc} "


def _rule_based_confidence(metadata: dict[str, Any], document_text: str) -> float:
    normalized_doc = _normalize_match_text(document_text)

    points = 0.0

    field_weights = {
        "First Name": (12.0, 10.0),
        "Middle Name or Initial": (3.0, 2.0),
        "Last Name": (12.0, 10.0),
        "Military Unit": (14.0, 12.0),
        "Regiment Number": (6.0, 6.0),
        "Regiment State": (8.0, 8.0),
        "Branch": (8.0, 8.0),
        "Company": (6.0, 6.0),
        "Age": (6.0, 6.0),
        "Year Born": (6.0, 6.0),
        "Transcript": (3.0, 3.0),
    }

    supports: dict[str, bool] = {}

    for field, (presence_weight, support_weight) in field_weights.items():
        value = metadata.get(field)
        if _has_value(value):
            points += presence_weight
        supported = _value_supported_in_text(field, value, normalized_doc)
        supports[field] = supported
        if supported:
            points += support_weight

    other_bonus_max = 10.0
    other = metadata.get("Other")
    if isinstance(other, dict) and other:
        bonus = 0.0
        for key, value in other.items():
            if not _has_value(key) or not _has_value(value):
                continue
            bonus += 2.0
            if _value_supported_in_text("Other", value, normalized_doc):
                bonus += 1.0
        points += min(other_bonus_max, bonus)

    core_fields = ("First Name", "Last Name", "Military Unit")
    core_presence_bonus = 5.0
    core_support_bonus = 8.0
    if all(_has_value(metadata.get(name)) for name in core_fields):
        points += core_presence_bonus
    if all(supports.get(name, False) for name in core_fields):
        points += core_support_bonus

    regiment_fields = ("Regiment Number", "Regiment State", "Branch")
    reg_presence_bonus = 4.0
    reg_support_bonus = 5.0
    if all(_has_value(metadata.get(name)) for name in regiment_fields):
        points += reg_presence_bonus
    if all(supports.get(name, False) for name in regiment_fields):
        points += reg_support_bonus

    age_year_bonus = 4.0
    if supports.get("Age") or supports.get("Year Born"):
        points += age_year_bonus

    max_points = (
        sum(p + s for (p, s) in field_weights.values())
        + other_bonus_max
        + core_presence_bonus
        + core_support_bonus
        + reg_presence_bonus
        + reg_support_bonus
        + age_year_bonus
    )

    confidence = points / max_points
    if confidence < 0.0:
        confidence = 0.0
    if confidence > 1.0:
        confidence = 1.0
    return round(confidence, 4)


def _finalize_confidence(metadata: dict[str, Any], document_text: str) -> dict[str, Any]:
    rule_conf = _rule_based_confidence(metadata, document_text)
    llm_conf = _to_confidence(metadata.get("Confidence"))

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

    result["First Name"] = _to_string_or_none(candidate.get("First Name"))
    result["Middle Name or Initial"] = _to_string_or_none(candidate.get("Middle Name or Initial"))
    result["Last Name"] = _to_string_or_none(candidate.get("Last Name"))
    military_unit = _to_string_or_none(candidate.get("Military Unit"))
    result["Military Unit"] = military_unit

    regiment_number = _to_int_or_none(candidate.get("Regiment Number"))
    if regiment_number is None:
        regiment_number = _infer_regiment_number_from_unit(military_unit)
    result["Regiment Number"] = regiment_number

    regiment_state = _normalize_state_abbrev(candidate.get("Regiment State"))
    if not regiment_state:
        regiment_state = _infer_regiment_state_from_unit(military_unit)
    result["Regiment State"] = regiment_state

    branch = _clean_branch_text(_to_string(candidate.get("Branch")))
    if not branch:
        branch = _infer_branch_from_unit(military_unit)
    result["Branch"] = branch

    result["Company"] = _normalize_company(candidate.get("Company"))
    result["Age"] = _to_int_or_none(candidate.get("Age"))
    result["Year Born"] = _to_int_or_none(candidate.get("Year Born"))
    result["Transcript"] = _to_string(candidate.get("Transcript"))
    result["Confidence"] = _to_confidence(candidate.get("Confidence"))

    source = candidate.get("Source")
    result["Source"] = str(source).strip() if source is not None else ""

    other = candidate.get("Other")
    if isinstance(other, dict):
        cleaned_other: dict[str, str] = {}
        for key, value in other.items():
            key_text = _to_string(key)
            value_text = _to_string(value)
            if key_text and value_text:
                cleaned_other[key_text] = value_text
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


def extract_metadata(
    document_text: str,
    maxTokens: int = 350,
    log_fn: LogFn | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    if log_fn:
        log_fn("Building metadata extraction prompt")

    messages = build_metadata_messages(document_text, system_prompt=system_prompt)

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



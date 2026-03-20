import transformers
import os
import torch
import json

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
    "Middle Name or Initial" : "value",
    "Last Name": "value",
    "Military Unit": "value",
    "Age": 0,
    "Year Born" : 0,
    "Other": {
        "other1": "value",
        "other2": "value"
    }
}


# The key of the json so the LLM knows what each key means.
jsonKey = {
    "First Name" : "The firstname of the soldier.",
    "Middle Name or Initial" : "value",
    "Last Name" : "The last name of the soldier.",
    "Military Unit": "The unit of the military that the soldier served in.",
    "Age": "The age of the soldier.",
    "Year Born": "The year the soldier was born.",
    "Other": {
        "": "Any other information you think would be useful. Replace the key with a more descriptive key. This info should be a short fact, not a long paragraph.",
        "": "More information you think would be useful. Feel free to add more or less values in the Other section as you see fit."
    }
}




if __name__ == "__main__":

    # The messages array including the system prompt and the user's prompt.
    messages = [
        {"role": "system", "content": f"You are a document analyzer. Given a document, analyze it and extract the necessary information to put into a JSON format. If a value cannot be found, set it to null. Return ONLY the ONE JSON and NOTHING ELSE. FORMAT the json so that it is easy to read (new lines and tabs). \nThe JSON format is as follows: {jsonFormat}\n\nHere are definitions of each key: {jsonKey}\n\n Stick to this format. The other section can be filled with any other information you think is useful. "},
        {"role": "user", "content": "Major Frank Biddle Ward, 15th Pennsylvania Cavalry At the onset of the war, 19 year old Frank Biddle Ward enlisted in the Duquesne Grays for three-months service. With the expiration of his initial enlistment, Ward continued service with the \"Anderson Troop,\" acting as an escort and guard for Army of the Ohio headquarters. Ward quickly advanced through the ranks to the grade of Junior Major, 15th Pennsylvania Cavalry. The young officer played a memorable role at the battle of Stones River on December 29, 1862 - leaving a lasting impression on his men for years to come. Much of what occurred during the winter engagement was recorded by members of the 15th, and published years later in their regimental history. "}
    ]

    # run the LLM with the message above and print the response
    response = run_llm(messages)
    # print("="*50)
    # print()
    # print(response)
    # print()

    jsonResponse = json.loads(response)
    print(type(jsonResponse))

    with open("llm_output.json", "w") as f:
        json.dump(jsonResponse, f, indent=2)

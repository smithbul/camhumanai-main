from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

import pandas as pd
from io import StringIO
import csv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Mount the static directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to restrict allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load OpenAI API key from environment variable
client = OpenAI(
    # This is the default and can be omitted
    api_key=os.environ.get("OPENAI_API_KEY"),
)

data = []

# Define request and response models
class QueryRequest(BaseModel):
    prompt: str

class QueryResponse(BaseModel):
    response: str


@app.post("/upload", response_model=QueryResponse)
async def upload_csv(file: UploadFile = File(...)):
    validate_csv_file(file)
    data_records = parse_csv_content(await file.read())

    # Update in-memory datastore
    data.clear()
    data.extend(data_records)

    # Return success message
    return JSONResponse(content={"message": "In-memory datastore updated successfully"})


def validate_csv_file(file: UploadFile):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are allowed."
        )


def parse_csv_content(contents: bytes):
    csv_file = StringIO(contents.decode("utf-8"))
    reader = csv.DictReader(csv_file)
    data_records = [row for row in reader]
    csv_file.close()
    return data_records



# Endpoint to interact with OpenAI API via LangChain
@app.post("/query1", response_model=QueryResponse)
async def query_openai(request: QueryRequest):
    try:
        # Set your OpenAI API key
        

        # Call the OpenAI API via LangChain
        chat_completion = client.chat.completions.create(
            messages=[

                {
                    "role": "user",
                    "content": request.prompt,
                }
            ],
            model="gpt-3.5-turbo",
        )

        return QueryResponse(response=chat_completion.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import FastAPI, HTTPException, status
import pandas as pd





@app.post("/query", response_model=QueryResponse)
async def query_openai(request: QueryRequest):
    if data:
        print("true")
        # Create DataFrame
        dataframe = pd.DataFrame(data)
        col_names = dataframe.columns
        col_types = {col: str(dtype) for col, dtype in dataframe.dtypes.items()}
        sample_records = dataframe.iloc[:10].to_dict(orient="records")

        # Read and format the initial prompt
        with open("prompt.txt", "r") as file:
            template = file.read()
        prompt = template % (col_names, col_types, sample_records)


        try:
            # Call OpenAI API for the first request
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": prompt,
                    },
                    {
                        "role": "user",
                        "content": request.prompt,
                    }
                ],
                model="gpt-3.5-turbo",
            )

            # Extract the first response content
            first_response_content = chat_completion.choices[0].message.content
            print(f"First response: {first_response_content}")

            # Read and format final text
            with open("finaltxt.txt", "r") as file:
                final_template = file.read()

            # Replace placeholders with actual values
            final = final_template % (request.prompt, first_response_content)


            # Call OpenAI API for the second request
            chat_completion_1 = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": final,  # Append the final text as user input
                    }


                ],
                model="gpt-3.5-turbo",
            )
            print(f"Last response: {chat_completion_1.choices[0].message.content}")
            # Return the response from the second request
            return QueryResponse(response=chat_completion_1.choices[0].message.content)

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    else:
        try:
            print("false")
            # Set your OpenAI API key
            nocsv_prompt = open('prompt_nocsv.txt').read()

            # Call the OpenAI API via LangChain
            chat_completion = client.chat.completions.create(
                messages=[
                                       {
                        "role": "system",
                        "content": nocsv_prompt,
                    },
                    {
                        "role": "user",
                        "content": request.prompt,
                    }
                ],
                model="gpt-3.5-turbo",
            )

            return QueryResponse(response=chat_completion.choices[0].message.content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# Root endpoint
@app.get("/")
async def read_root():
    return FileResponse('static/index.html')
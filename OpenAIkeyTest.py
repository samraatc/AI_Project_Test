import os
from openai import OpenAI

client = OpenAI(api_key="sk-proj-YOUR_KEY_HERE")

try:
    models = client.models.list()
    print("✅ API Key is valid")

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say API OK"}]
    )

    print("Response:", res.choices[0].message.content)

except Exception as e:
    print("❌ Error:", e)
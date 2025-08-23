import pandas as pd
from uuid import uuid4
import os

data = {
    "Vehicle ID": [
        "4b9d7552-7b52-4756-8fad-2afd33528a63",
        "9574b46e-b223-4e97-b4e5-7c8d9f16b4a1",
    ],
    "Vehicle Name": ["Honda Insight", "Nissan Leaf"],
    "Mileage": [11142, 7500],
}

df = pd.DataFrame(data)
file_path = os.path.join("test_excel", "example_mileage_upload.xlsx")
df.to_excel(file_path, index=False)

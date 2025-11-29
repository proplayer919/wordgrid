from flask import Flask, jsonify, request
from pymongo import MongoClient
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB setup
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/wordgrid")
client = MongoClient(mongo_uri)
db = client.get_default_database()
leaderboard_collection = db["leaderboard"]


@app.route("/leaderboard/<date>", methods=["GET"])
def get_leaderboard(date):
    leaderboard = list(
        leaderboard_collection.find({"date": date}, {"_id": 0}).sort("score", 1)
    )
    return jsonify(leaderboard)


@app.route("/leaderboard", methods=["POST"])
def add_score():
    data = request.get_json()
    if "name" in data and "score" in data and "date" in data:
        if (
            not isinstance(data["name"], str)
            or not isinstance(data["score"], int)
            or not isinstance(data["date"], str)
        ):
            return jsonify({"error": "Invalid data types!"}), 400

        if data["name"] == "" or data["date"] == "":
            return jsonify({"error": "Name and date cannot be empty!"}), 400

        if len(data["name"]) > 50:
            return jsonify({"error": "Name is too long!"}), 400
          
        if len(data["date"]) > 10:
            return jsonify({"error": "Date is too long!"}), 400

        leaderboard_collection.insert_one(
            {"name": data["name"], "score": data["score"], "date": data["date"]}
        )
        return jsonify({"message": "Score added successfully!"}), 201
    else:
        return jsonify({"error": "Invalid data!"}), 400


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    app.run(host="0.0.0.0", port=port, debug=debug)

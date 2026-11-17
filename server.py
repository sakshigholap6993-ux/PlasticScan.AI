from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
from PIL import Image
import numpy as np
import cv2
import os
import base64

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

print("Loading PlasticScan AI model...", flush=True)

model = YOLO(MODEL_PATH)

print("Model loaded successfully!", flush=True)


@app.route("/")
def home():
    return render_template("index.html")


# SUPPORT BOTH /predict AND /analyze
@app.route("/predict", methods=["POST"])
@app.route("/analyze", methods=["POST"])
def analyze():

    try:
        file = request.files.get("image")

        if file is None or file.filename == "":
            return jsonify({
                "error": "Please upload or capture an image."
            }), 400

        image = Image.open(file.stream).convert("RGB")
        image_array = np.array(image)

        result = model.predict(
            image_array,
            conf=0.25,
            verbose=False
        )[0]

        annotated = result.plot()

        success, encoded = cv2.imencode(".jpg", annotated)

        if not success:
            return jsonify({
                "error": "Could not process result image."
            }), 500

        result_image = base64.b64encode(
            encoded.tobytes()
        ).decode("utf-8")

        materials = []
        total_pixels = 0

        if result.masks is not None and result.boxes is not None:

            height, width = result.orig_shape

            pixel_map = np.full(
                (height, width),
                -1,
                dtype=np.int32
            )

            confidence_map = np.zeros(
                (height, width),
                dtype=np.float32
            )

            masks = result.masks.data.cpu().numpy()

            for i, mask in enumerate(masks):

                resized_mask = cv2.resize(
                    mask.astype(np.float32),
                    (width, height),
                    interpolation=cv2.INTER_NEAREST
                ) > 0.5

                class_id = int(result.boxes.cls[i].item())
                confidence = float(result.boxes.conf[i].item())

                update = resized_mask & (
                    confidence > confidence_map
                )

                pixel_map[update] = class_id
                confidence_map[update] = confidence

            total_pixels = int(
                np.count_nonzero(pixel_map >= 0)
            )

            if total_pixels > 0:

                for class_id, name in model.names.items():

                    count = int(
                        np.count_nonzero(
                            pixel_map == int(class_id)
                        )
                    )

                    if count > 0:

                        materials.append({
                            "name": str(name),
                            "percentage": round(
                                count / total_pixels * 100, 2
                            ),
                            "pixels": count
                        })

        return jsonify({
            "success": True,
            "result_image": result_image,
            "materials": materials,
            "total_detections": (
                len(result.boxes)
                if result.boxes is not None else 0
            ),
            "total_pixels": total_pixels
        })

    except Exception as e:

        app.logger.exception("Analysis failed")

        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
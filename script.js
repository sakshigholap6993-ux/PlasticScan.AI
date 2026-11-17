const imageInput = document.getElementById("imageInput");
const previewImage = document.getElementById("previewImage");
const previewContainer = document.getElementById("previewContainer");
const fileName = document.getElementById("fileName");

const cameraPreview = document.getElementById("cameraPreview");
const cameraCanvas = document.getElementById("cameraCanvas");

const startCameraButton = document.getElementById("startCameraButton");
const captureButton = document.getElementById("captureButton");
const stopCameraButton = document.getElementById("stopCameraButton");

const detectButton = document.getElementById("detectButton");

let cameraStream = null;

if (imageInput) {
    imageInput.addEventListener("change", function () {
        const file = this.files[0];

        if (file) {
            previewImage.src = URL.createObjectURL(file);
            previewContainer.style.display = "block";
            fileName.textContent = file.name;
            stopCamera();
        }
    });
}

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false
        });

        cameraPreview.srcObject = cameraStream;
        cameraPreview.style.display = "block";

        await cameraPreview.play();

        startCameraButton.style.display = "none";
        captureButton.style.display = "inline-block";
        stopCameraButton.style.display = "inline-block";

    } catch (error) {
        alert("Camera error: " + error.message);
    }
}

function captureImage() {
    if (!cameraStream || !cameraPreview.videoWidth) {
        alert("Camera is not ready.");
        return;
    }

    cameraCanvas.width = cameraPreview.videoWidth;
    cameraCanvas.height = cameraPreview.videoHeight;

    const context = cameraCanvas.getContext("2d");

    context.drawImage(
        cameraPreview,
        0,
        0,
        cameraCanvas.width,
        cameraCanvas.height
    );

    cameraCanvas.toBlob(function (blob) {
        if (!blob) {
            alert("Capture failed.");
            return;
        }

        const capturedFile = new File(
            [blob],
            "camera_capture.jpg",
            { type: "image/jpeg" }
        );

        const transfer = new DataTransfer();
        transfer.items.add(capturedFile);

        imageInput.files = transfer.files;

        previewImage.src = URL.createObjectURL(blob);
        previewContainer.style.display = "block";
        fileName.textContent = "camera_capture.jpg";

        stopCamera();

    }, "image/jpeg", 0.95);
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    if (cameraPreview) {
        cameraPreview.srcObject = null;
        cameraPreview.style.display = "none";
    }

    if (startCameraButton) startCameraButton.style.display = "inline-block";
    if (captureButton) captureButton.style.display = "none";
    if (stopCameraButton) stopCameraButton.style.display = "none";
}

async function detectPlastic(event) {
    event.preventDefault();

    const file = imageInput.files[0];

    if (!file) {
        alert("Please upload or capture an image first.");
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    detectButton.disabled = true;
    detectButton.textContent = "Detecting...";

    let resultsDiv = document.getElementById("results");

    if (!resultsDiv) {
        resultsDiv = document.createElement("div");
        resultsDiv.id = "results";
        document.querySelector(".container").appendChild(resultsDiv);
    }

    resultsDiv.innerHTML = "<h2>Analyzing image...</h2>";

    try {
        const response = await fetch("/predict", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Detection failed.");
        }

        let html = `
            <h2>Detection Results</h2>
            <img
                src="data:image/jpeg;base64,${data.result_image}"
                style="width:100%;max-width:600px;border-radius:12px;"
                alt="Detected plastic materials"
            >
            <h3>Total Detections: ${data.total_detections}</h3>
            <h3>Material Composition</h3>
        `;

        if (data.materials.length > 0) {
            data.materials.forEach(material => {
                html += `
                    <div style="padding:12px;margin:10px 0;background:#f0fdf4;border-radius:8px;">
                        <strong>${material.name}</strong>
                        <p>${material.percentage}%</p>
                        <div style="background:#ddd;height:12px;border-radius:10px;">
                            <div style="
                                background:#16a34a;
                                width:${material.percentage}%;
                                height:12px;
                                border-radius:10px;">
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += "<p>No segmented materials detected.</p>";
        }

        resultsDiv.innerHTML = html;

        resultsDiv.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
        resultsDiv.innerHTML = `
            <h3>Detection Error</h3>
            <p>${error.message}</p>
        `;
    } finally {
        detectButton.disabled = false;
        detectButton.textContent = "Detect Plastic";
    }
}

if (startCameraButton) {
    startCameraButton.addEventListener("click", startCamera);
}

if (captureButton) {
    captureButton.addEventListener("click", captureImage);
}

if (stopCameraButton) {
    stopCameraButton.addEventListener("click", stopCamera);
}

const uploadForm = document.querySelector("form");

if (uploadForm) {
    uploadForm.addEventListener("submit", detectPlastic);
}
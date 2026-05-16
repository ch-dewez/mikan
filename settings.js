let exportButton = document.getElementById("exportButton");

let importButton = document.getElementById("importButton");
let importFileInput = document.getElementById("importFileInput");
let importFileError = document.getElementById("importError");
let importSuccess = document.getElementById("importSuccess");

let migrateButton = document.getElementById("migrationButton");
let migrateFileInput = document.getElementById("migrateFileInput");
let migrateError = document.getElementById("migrationError");
let migrateSucess = document.getElementById("migrationSuccess");

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const downloadJson = (data, filename) => {
  const jsonString = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonString], { type: "application/json" });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

async function getAllData() {
  let data = await browserAPI.runtime.sendMessage({ type: 'getAllData' })
  return data;
}

exportButton.addEventListener("click", async () => {
  let data = await getAllData();
  downloadJson(data, "MikanExport.json");
});

async function replaceData(file) {
  try {
    let text = await file.text();
    let json = await JSON.parse(text);
    await browserAPI.runtime.sendMessage({ type: 'replaceAllData', data: json });
    importSuccess.textContent = "Data imported!";
  } catch (e) {
    importFileError.textContent = "Error handling file: " + e;
    console.error("Error handling file:", e);
  }
}

importButton.addEventListener("click", async () => {
  if (importFileInput.files.length != 1) {
    importFileError.textContent = "Error, more or less than one file";
    return;
  }
  importFileError.textContent = "";
  replaceData(importFileInput.files[0]);
})


async function migrateData(file) {
  try {
    let text = await file.text();
    let json = await JSON.parse(text);

    let new_data = {
      "Watching": [],
      "Reading": [],
      "Speaking": []
    };

    for (date in json) {
      let dayData = json[date];

      let new_format = {
        "date": date,
        "websites": {
          "YouTube": dayData.totalSeconds
        },
        "total": dayData.totalSeconds,
      }

      new_data["Watching"].push(new_format);
    }

    await browserAPI.runtime.sendMessage({ type: 'replaceAllData', data: new_data });
    migrateSucess.textContent = "Data imported!";
  } catch (e) {
    migrateError.textContent = "Error handling file: " + e;
    console.error("Error handling file:", e);
  }
}

migrateButton.addEventListener("click", async () => {
  if (migrateFileInput.files.length != 1) {
    migrateFileInput.textContent = "Error, more or less than one file";
    return;
  }
  migrateError.textContent = "";
  migrateData(migrateFileInput.files[0]);
})

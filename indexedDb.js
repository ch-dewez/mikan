const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let db;
const openOrCreateDB = indexedDB.open('MikanDB', 1)

openOrCreateDB.addEventListener('error', () => console.error('Error opening DB'));

openOrCreateDB.addEventListener('success', () => {
  db = openOrCreateDB.result;
  console.log('Successfully opened DB', db);
});

openOrCreateDB.addEventListener('upgradeneeded', init => {
  db = init.target.result;

  db.onerror = () => {
    console.error('Error loading database.');
  };

  const tableWatching = db.createObjectStore('Watching', { keyPath: 'date' });
  const tableReading = db.createObjectStore('Reading', { keyPath: 'date' });
  const tableSpeaking = db.createObjectStore('Speaking', { keyPath: 'date' });

  tableWatching.createIndex('Websites', 'websites', { unique: false });
  tableWatching.createIndex('Total Seconds', 'total', { unique: false });
  tableReading.createIndex('Websites', 'websites', { unique: false });
  tableReading.createIndex('Total Seconds', 'total', { unique: false });
  tableSpeaking.createIndex('Websites', 'websites', { unique: false });
  tableSpeaking.createIndex('Total Seconds', 'total', { unique: false });
});

export function addTime(category, date, website, time) {
  // fix of a bug, idk why it happens, TODO: maybe find the root of the bug?
  if (typeof time != "number") {
    return
  }
  if (website == "") {
    website = "Manual"
  }
  const transaction = db.transaction([category], 'readwrite');
  const objectStore = transaction.objectStore(category);

  const getRequest = objectStore.get(date);


  getRequest.onsuccess = (event) => {
    let existing = event.target.result;

    if (!existing) {
      existing = { date: date, websites: {}, total: 0 };
    }

    // 4. Modify the object in memory
    existing.total += time;
    if (!existing.websites[website]) {
      existing.websites[website] = 0;
    }
    existing.websites[website] += time;


    // 5. Use put() to store the updated object back
    const putRequest = objectStore.put(existing);

    putRequest.onsuccess = () => {
      //console.log("Note updated successfully!");
    };

    putRequest.onerror = (event) => {
      console.error("Error updating note:", event.target.error);
    };
  }
};

export async function getDayTotal(date) {
  let totalTime = 0;
  totalTime += await getDayCategoryTotal("Reading", date);
  totalTime += await getDayCategoryTotal("Speaking", date);
  totalTime += await getDayCategoryTotal("Watching", date);
  return totalTime;
}

export async function getDayCategoryTotal(category, date) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(category);
    const objectStore = transaction.objectStore(category);

    const getRequest = objectStore.get(date);
    getRequest.onsuccess = (event) => {
      let existing = event.target.result;
      if (existing == undefined) {
        resolve(0);
        return;
      }
      resolve(existing.total);
    }

    getRequest.onerror = () => {
      reject("error happened");
    };

  })
}

export async function getAllData() {
  let result = { Reading: [], Watching: [], Speaking: [] };

  result["Reading"] = await getAllDataCategory("Reading");
  result["Watching"] = await getAllDataCategory("Watching");
  result["Speaking"] = await getAllDataCategory("Speaking");

  return result;
}

export async function getAllDataCategory(category) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(category);
    const store = transaction.objectStore(category);

    const request = store.getAll();

    request.onsuccess = function(event) {
      const allData = event.target.result; // 'allData' is an array of all the objects
      resolve(allData);
    };

    request.onerror = function(event) {
      console.error("Error retrieving data:", event.target.error);
      reject();
    };
  });
}


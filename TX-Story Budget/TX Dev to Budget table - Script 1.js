//Run Script 1
//Pull existing records from Budget Table for today to match for de-dupe
//Created by Kerry Mraz (kerry.mraz@hearst.com)
//Pull of existing records from Budget Table to compare against to DeDupe slugs
//2024.02.05 Refactored from one large autoamation script to multiple Run Script
//           with try/catch, delays, to prevent network timeout

const {
    budgetTable,
    primaryField,
    thisAirtableId,
    maxTries,
    delay,
    debug,
} = input.config();
const maxTriesInt = parseInt(maxTries);
const delayInt = parseInt(delay);

let errorDetected = '';

//trying a new sleep function to put in a slight delay on retry
//just a short delay to try and allow the network to clear
function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
        break;
        }
    }
}

// helper function (provided by Airtable)
// This creates a map object of primary field and record ID
// this is used to create a simple way of matching against existing records
// example: { FeatureX-AccountY: "recWer23radda" }
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    mapping[existingRecord.getCellValueAsString(fieldName)] = existingRecord.id
  }
  return mapping
}

const slugTable = base.getTable(budgetTable);//Budget
const slugDailyView = slugTable.getView('Created in last day');
let count = 0;
while(true) {
    try {
        let existingRecords = await slugDailyView.selectRecordsAsync({ fields: [primaryField] });
        let mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(existingRecords.records, primaryField);
        // break out of loop, or return, on success
        output.set('existingRecordsJSON', JSON.stringify(mapOfUniqueIdToExistingRecordId));
        output.set('debug', debug);
        output.set('maxTries', maxTries);
        output.set('delay', delay);
        output.set('errorDetected', errorDetected);
        var d = new Date();
        var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
        output.set('Start Time', n);
        break;
    } catch (e) {
        // handle exception
        if (count >= maxTriesInt) {
            console.error(`Max retries (${maxTriesInt}) exhausted, final error thrown:`);
            throw e;
        } else {
            var d = new Date();
            var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
            console.error(`Error during attempt #${count}:`);
            console.error(n);
            console.error(`Name: `+e.name);
            console.error(`Message: `+e.message);
            errorDetected = thisAirtableId;
            sleep(delayInt);
            count++;
        }
    }
}

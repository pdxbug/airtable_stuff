//Run Script 3
//Check for duplication of slugs
//Created by Kerry Mraz (kerry.mraz@hearst.com)
//Check for duplicate slug names and DeDupe
//2024.02.05 Refactored from one large autoamation script to multiple Run Script
//           with try/catch, delays, to prevent network timeout
const {
    budgetTableName,
    devTableName,
    thisRecordId,
    thisRecordName,
    existingRecordsFromScript,
    thisRecordFields,
} = input.config();

// get the table, view and fields we will be pushing to
const budgetTable = base.getTable(budgetTableName);//Budget
const slugTempTable = base.getTable(devTableName);//Dev Table

// load existing records from the DailyView in the Slugs table
// originally we were trying to pull all records, but this changed for two reasons
// 1. When you get over 10k records, it was breaking our 30 second limit
// 2. We only need to pull for today since the auto-slug adds the date and we can only match
//limit to the slug field as we don't need every field in the search
let existingRecords = JSON.parse(existingRecordsFromScript);
let newRecord = {id:thisRecordId, name:thisRecordName};
//used for diagnosing problems
console.log(newRecord);
let matchString = newRecord.name;
console.log("Name: "+matchString);

//pull the new record's information from all fields
//we will need to organize the new record's information depending on the columns type
//airtable expects different data formats for Multi-arrays versus text and numbers
//also we will need to pull the Digital/Online Channels into a single field
let thisRecord = JSON.parse(thisRecordFields);
console.log(thisRecord);
// create initial variables
let counter = -1;

console.log(existingRecords);
//de duplication
//use the existing slugs array to see if the new slug already exists
let recordMatch = existingRecords[matchString];

// There is a match, adjust by counter
if (recordMatch !== undefined) {
    //we have a recordMatch and need to increase the count value and check again
    console.log("Slug already exists: Original Match string: "+matchString);
    for (counter = 1; counter < 10; counter++) {
        let tempMatchString = matchString+'-'+counter;
        let recordMatch = existingRecords[tempMatchString];
        Object.keys(existingRecords).forEach(key => {
            if (key == tempMatchString) {
                recordMatch = true;
            }
        });
        if (recordMatch === undefined) {
            matchString = tempMatchString;
            console.log("Break Match string: "+matchString);
            thisRecord['Slug Key'] = thisRecord['Slug Key']+'-'+counter
            break;
        }
        console.log("Slug already exists: Match string: "+tempMatchString);
    }
}

console.log(`matchString does not exist, let's create it`)

console.log(thisRecord);
// break out of loop, or return, on success
output.set('recordsToCreate', JSON.stringify(thisRecord));
output.set('recordsToCreateObject', thisRecord);

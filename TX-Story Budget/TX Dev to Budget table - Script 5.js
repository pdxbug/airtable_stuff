//Run Script 5
//Creates secondaries
//Created by Kerry Mraz (kerry.mraz@hearst.com)
//This will take new records from the form and push to the budget table
//2024.02.05 Refactored from one large autoamation script to multiple Run Script
//           with try/catch, delays, to prevent network timeout
const {
    budgetTableName,
    recordToCreateJSON,
    secondaryPubsJSON,
    primaryCreatedTimeStr,
    primaryRecordId,
    maxTries,
    delay,
    debug,
    errorDetectedConst,
    thisAirtableId,
    startTime,
} = input.config();

let errorDetected = errorDetectedConst;

let primaryCreatedTime = new Date(primaryCreatedTimeStr);
//try/catch maximum number of retries
const maxTriesInt = parseInt(maxTries);
const delayInt = parseInt(delay);
let tryCatchCount = 0;

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

// get the table, view and fields we will be pushing to
const slugTable = base.getTable(budgetTableName);//Budget

// load existing records from the DailyView in the Slugs table
// originally we were trying to pull all records, but this changed for two reasons
// 1. When you get over 10k records, it was breaking our 30 second limit
// 2. We only need to pull for today since the auto-slug adds the date and we can only match
//limit to the slug field as we don't need every field in the search

//pull the new record's information from all fields
//we will need to organize the new record's information depending on the columns type
//airtable expects different data formats for Multi-arrays versus text and numbers
//also we will need to pull the Digital/Online Channels into a single field

function clone(object) {
    var clone ={};
    for( var key in object ){
        if(object.hasOwnProperty(key)) //ensure not adding inherited props
            clone[key]=object[key];
    }
    return clone;
}

let recordToCreate = JSON.parse(recordToCreateJSON);
console.log(recordToCreate);
const publicationTable = base.getTable('🔒 Publications');
const publicationView = publicationTable.getView('Texas');
let publicationTitles;
while(true) {
    try {
        publicationTitles = await publicationView.selectRecordsAsync({fields: ['Publication Title']});
        break;
    } catch (e) {
        // handle exception
        if (tryCatchCount >= maxTriesInt) {
            console.error(`Max retries (${maxTriesInt}) exhausted, final error thrown:`);
            throw e;
        } else {
            var d = new Date();
            var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
            console.error(`Error during attempt #${tryCatchCount}:`);
            console.log(n);
            console.error(`Name: `+e.name);
            console.error(`Message: `+e.message);
            sleep(delayInt);
            errorDetected = thisAirtableId;
            tryCatchCount++;
        }
    }
}

let secondaryPubs = JSON.parse(secondaryPubsJSON);
console.log(secondaryPubs);
//secondary publications
if (secondaryPubs) {
    //check for All Texas and recreate secondary Pubs
    for (let secondaryPub of secondaryPubs) {
        //checking for all texas
        if (secondaryPub.name == 'All Texas') {
            let newSecondaryPubs = [];
            //we need to grab all the publications and set into secondaryPubs
            console.log(recordToCreate['Primary Publication'][0])
            for (publicationTitle of publicationTitles.records) {
                if (publicationTitle.name != 'Wires' && publicationTitle.name != 'All Texas' && publicationTitle.name != recordToCreate['Primary Publication'][0].name ) {
                    newSecondaryPubs.push(publicationTitle); 
                }
            }
            console.log(newSecondaryPubs);
            secondaryPubs = newSecondaryPubs;
            break;
        }
    }
    
    //creating each of the Secondary Publications in Budgets
    let secondaryRecords = [];
    for (let secondaryPub of secondaryPubs) {
        let createThisRecord = recordToCreate;
        if (recordToCreate['Primary Publication'][0].name == secondaryPub.name) {
            console.log("primary pub and secondary pub match, skipping");
        } else {
            //create the Secondary Publication
            console.log(`Creating Secondary Publication in Budget for `+secondaryPub.name);
            console.log(secondaryPub);
            createThisRecord['Secondary Publication'] = [secondaryPub];
            createThisRecord['Primary Record Lookup'] = [{id:primaryRecordId}];
            createThisRecord['Primary Record ID'] = primaryRecordId;
            createThisRecord['Primary Created Time'] = primaryCreatedTime;
            createThisRecord['Secondary check'] = true;
            // console.log(createThisRecord.fields);
            secondaryRecords.push( {fields: clone(createThisRecord)} );
            console.log(secondaryRecords);
        }
    }

    let secondaryIds = [];
    if (secondaryRecords.length > 0) {
        console.log(secondaryRecords);
        if (debug == "false") {
            tryCatchCount = 0;
            while(true) {
                try {
                    secondaryIds = await slugTable.createRecordsAsync(secondaryRecords);
                    // break out of loop, or return, on success
                    break;
                } catch (e) {
                    // handle exception
                    if (tryCatchCount >= maxTriesInt) {
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
                        tryCatchCount++;
                    }
                }
            }            
            if (secondaryIds.length > 0) {
                //update the primary with the secondary Ids
                console.log('updating primary with secondary records');
                console.log(secondaryIds);
                let theseSecondaries = [];
                for (let secondaryId of secondaryIds) {
                    theseSecondaries.push({id:secondaryId}); 
                }
                output.set('theseSecondaries', theseSecondaries);

            }
        } else {
            console.log("debug set to true, otherwise would have created the secondary record in "+budgetTableName);
        }
    }
} else {
    output.set('theseSecondaries', []);
}

if (debug == "true") {
    let theseSecondaries = [{id:'recYwyne8J2pNgPy7'},{id:'recDf8taXLnXfSbUS'}];
    output.set('theseSecondaries', theseSecondaries);
    throw new Error('Debug set to true, halt before update');
    //this will break the automation for the 'update record airtable directly below...'
}

output.set('errorDetected', errorDetected);
console.log('Start Time: '+startTime);
var d = new Date();
var n = d.toLocaleTimeString('en-US', {timeZone: "America/Chicago"});
console.log('End Time: '+n);

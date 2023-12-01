/** Created by Kerry Mraz (kerry.mraz@hearst.com) part of the HNP IT Editorial Team
 * The script is designed to take new records created in the form and included in the 'Dev Table'
 * process for duplicates, combine Digital/Online Channels, create Secondary Publication
 * 
 * De-duplication:
 * At times, multiple users will attempt to submit the same story (slug). This automation will 
 * check to see if the slug was already submitted today (auto slugging will add the day's date
 * so it doesn't work if the users are a day or more apart in submission). If the slug was already
 * created, it will create the story, but append a dash and number (exampleslug-1) to the slug that
 * will signify to the editors that one already exists
 * 
 * Digital/Online Channels:
 * Each community within each newsroom has multiple Digital Channels
 * Individual sorting into separate questions forces separate fields in the table
 * If all Digital Channels were in a single question, users would have to search 
 * for their channel out of hundreds instead of searching through 20-30
 * These fields needed to be combined to a single table in the Budget Table
 * 
 * Secondary/Sister Publications:
 * A user creating a story may wish to have the story appear in other newspapers
 * This happens for Houston and San Antonio for political stories a lot.
 * If the user submits a Secondary Publication, a separate record needs to be created
 * Sister Publications are publications that regularly print stories in both papers
 * and the automation will automatically create the Secondary Publication without user
 * intervention
 * 
 * Keywords:
 * Some publications want to include keywords, this needed to be pushed a separate way 
 * than normal entry, see notes below
 *
 */


/**set the constant variables
* this creates the budgetTable 'Budget', txTable 'Dev Table', primaryFieldName 'Slug',
* it pulls in the record ID and record Name that was just created for quick comparison of values
* sets the debug value false means it will run the slugs into the Budget Table and true means it will only debug
* preventing any records from being created in the Budget Table (very useful for code debugging without creating 
* records that need to be removed later)
*
*/
const {
    budgetTable,
    txTable,
    primaryFieldName,
    thisRecordId,
    thisRecordName,
    debug,
} = input.config();

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

// get the table, view and fields we will be pushing to
const slugTable = base.getTable(budgetTable);
const slugDailyView = slugTable.getView('Created in last day');
const slugTempTable = base.getTable(txTable);
const newRecords = await slugTempTable.selectRecordsAsync(
    {fields: ["Slug", "Submission Date"],
    sorts: [
       {field: "Submission Date"},
    ]
    });
//console.log(newRecords.records)

// load existing records from the DailyView in the Slugs table
// originally we were trying to pull all records, but this changed for two reasons
// 1. When you get over 10k records, it was breaking our 30 second limit
// 2. We only need to pull for today since the auto-slug adds the date and we can only match
// against today's slugs
let existingRecords = await slugDailyView.selectRecordsAsync({ fields: slugTable.fields });
let mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(existingRecords.records, primaryFieldName);
let newRecord = {id:thisRecordId, name:thisRecordName};

// create initial variables
let counter = -1;
let recordsToCreate = [];
let secondaryPubs;
let primaryCreatedTime = '';

//used for diagnosing problems
console.log(newRecord);
let matchString = newRecord.name;
console.log("Name: "+matchString);

//de duplication
//use the existing slugs array to see if the new slug already exists
let recordMatch = mapOfUniqueIdToExistingRecordId[matchString];

// There is a match, adjust by counter
if (recordMatch !== undefined) {
    //we have a recordMatch and need to increase the count value and check again
    console.log("Slug already exists: Original Match string: "+matchString);
    for (counter = 1; counter < 10; counter++) {
        let tempMatchString = matchString+'-'+counter;
        let recordMatch = mapOfUniqueIdToExistingRecordId[tempMatchString];
        Object.keys(mapOfUniqueIdToExistingRecordId).forEach(key => {
            if (key == tempMatchString) {
                recordMatch = true;
            }
        });
        if (recordMatch === undefined) {
            matchString = tempMatchString;
            console.log("Break Match string: "+matchString);
            break;
        }
        console.log("Slug already exists: Match string: "+tempMatchString);
    }
}

console.log(`matchString does not exist, let's create it`)
let fields = {};
let primaryRecordId = '';
var DSOsearch = true;

//pull the new record's information from all fields
//we will need to organize the new record's information depending on the columns type
//airtable expects different data formats for Multi-arrays versus text and numbers
//also we will need to pull the Digital/Online Channels into a single field
let queryResult = await slugTempTable.selectRecordsAsync({fields: slugTempTable.fields});
let records = queryResult.getRecord(newRecord.id);

//go through each column (field)
for (let field of slugTempTable.fields) {
    //console.log(`Field Name: `+field.name)
    if (field.name == "Submission Date" || 
        field.name == "Site Abbrev" || 
        field.name == "Slug" ) {
        //skip due to a field that doesn't exist in Budget table, 
        //or a field that is auto generated in Budget
    } else if (field.name == "Created Time") {
        primaryCreatedTime = records.getCellValue(field.name);
    } else if (field.name == "Secondary Publication") {
        //get the list of secondary publications for creating the secondary pub records later
        secondaryPubs = records.getCellValue(field.name);
        console.log('adding secondary');
        console.log(records.getCellValue(field.name));
    } else if (field.name == "Other Media") {
        //These are multi and single select fields
        //requires a different input from text/numbers/etc
        let queryResult = await slugTempTable.selectRecordsAsync(
            {
                fields: [field.name, "Submission Date"],
                sorts: [
                    {field: "Submission Date"},
                ]
            }
        );
        let record = records.getCellValue(field.name);
        if (record) {
            if (Array.isArray(record)) {
                //multi select
                console.log(field.name+' IS an array');
                record.forEach(function (arrayItem) {
                    delete arrayItem.id;
                    delete arrayItem.color;
                });
                if (field.name.includes('Keywords')) {
                    //we needed a special configuration for Keywords
                    //for now we store them in a list/array
                    if (keywords.length == 0) {
                        console.log('start keywords with '+record);
                        keywords = record;
                    } else {
                        //we need to go through and remove duplicates?
                        let keywordMatch = false;
                        record.forEach(function (arrayItem) {
                            for (let keyword of keywords) {
                                if (keyword == arrayItem) {
                                    keywordMatch = true;
                                }
                            }
                            if (keywordMatch === false) {
                                // console.log('add '+arrayItem);
                                keywords.push(arrayItem);
                            }
                        });
                    }
                } else {
                    fields[field.name] = record;
                }
            } else {
                //single select
                // Array<{id: string}>,
                console.log(field.name+' is NOT an array');
                // the single select would take the record name but not the id
                delete record.id;
                fields[field.name] = {name: record.name};
            }
        }
    } else if (field.name.indexOf(" Channel") != -1) {
        //Digital or Online channel search to add to a single field
        //otherwise it would attempt to add each form field into separate
        //fields in budget and error
        if (DSOsearch) {
            if (records.getCellValue(field.name)) {
                console.log(field.name+` found! `)
                fields["Channel ID"] = records.getCellValue(field.name);
                console.log(fields["Channel ID"])
                DSOsearch = false;
            }
        }
    } else {
        if ((field.name == "Slug" || field.name == "Slug Key") && counter != "-1") {
            //a fix for the slug if there were duplicates
            fields[field.name] = records.getCellValue(field.name)+'-'+counter;
        } else if (records.getCellValue(field.name) != null) {
            //all other fields not caught above can just be pushed into the field
            //this assumes that the field in Dev Table is EXACTLY the same as the 
            //field in Budget table (including emojis!)
            fields[field.name] = records.getCellValue(field.name);
        } else {
            //skip anything that is null as it will automatically be null or default
            //value in budget table
            //console.log(field.name+" was null, skipping");
        }
    }
}

recordsToCreate.push({
    fields
});

console.log('records to create');
console.log(recordsToCreate);
console.log('secondaries pre sisters');
console.log(secondaryPubs);
for (let recordToCreate of recordsToCreate) {
    //creating the Primary Publication in Budgets
    if (debug == "false") {
        primaryRecordId = await slugTable.createRecordAsync(recordToCreate.fields);
        console.log('primaryRecordId: '+primaryRecordId);
    } else {
        primaryRecordId = 'debug is true';
        console.log("debug set to true, otherwise would have created the new record in "+budgetTable);
    }

    //check for sister pubs
    const publicationTable = base.getTable('🔒 Publications');//<-- see you have to include the emojis!
    const autoPitchView = publicationTable.getView('Weeklies - Auto Pitch');
    //console.log(autoPitchView);
    const sisterPubsResults = await autoPitchView.selectRecordsAsync({fields: ["Publication Title","Auto Pitch Pubs"]});
    
    for (sisterPubsResult of sisterPubsResults.records) {
        if (sisterPubsResult.name == recordToCreate.fields['Primary Publication'][0].name) {
            //they have sister pubs, loop through all sister pubs, loop through the secondaryPubs and add if it doesn't exist
            let sisterPubs = sisterPubsResult.getCellValue("Auto Pitch Pubs");
            if (secondaryPubs && sisterPubs) {
                console.log(sisterPubs);
                var $notInSecondary;
                for (sisterPub of sisterPubs) {
                    $notInSecondary = true;
                    for (secondaryPub of secondaryPubs) {
                        if (secondaryPub.name == sisterPub.name) {
                            $notInSecondary = false;
                        }
                    }
                    if ($notInSecondary == true) {
                        secondaryPubs.push(sisterPub);
                    }
                }
            } else if (!secondaryPubs && sisterPubs) {
                secondaryPubs = sisterPubs;
            }
        }
    }

console.log('secondaries post sisters');
console.log(secondaryPubs);
    //secondary publications
    if (secondaryPubs) {
        //check for All CT dailies and recreate secondary Pubs
        //this is usually where we run into trouble as we need to see how many other secondary publications
        //we need to create. If it is 10+ we may run out of time (30 seconds max)
        for (let secondaryPub of secondaryPubs) {
            //checking for all All CT dailies
            if (secondaryPub.name == 'All CT dailies') {
                let newSecondaryPubs = [];
                //we need to grab all the publications and set into secondaryPubs
                const dailiesView = publicationTable.getView('Daily papers');
                const publicationTitles = await dailiesView.selectRecordsAsync({fields: ['Publication Title']});
                console.log(recordToCreate.fields['Primary Publication'][0])
                for (publicationTitle of publicationTitles.records) {
                    if (publicationTitle.name != 'Wires' && publicationTitle.name != 'All CT dailies' && publicationTitle.name != recordToCreate.fields['Primary Publication'][0].name ) {
                        newSecondaryPubs.push(publicationTitle); 
                    }
                }
                console.log(newSecondaryPubs);
                secondaryPubs = newSecondaryPubs;
                break;
            }
        }
        // console.log(secondaryPubs);
        //get the array ready for secondary pub creation
        //remove the Primary fields from the Secondary Publication
        if (recordToCreate.fields['Channel ID']) {
            delete recordToCreate.fields['Channel ID']
        }
        if (recordToCreate.fields['Primary Site']) {
            delete recordToCreate.fields['Primary Site']
        }
        
        //creating each of the Secondary Publications in Budgets
        let secondaryIds = [];
        for (let secondaryPub of secondaryPubs) {
            let secondaryId = '';
            if (recordToCreate.fields['Primary Publication'][0].name == secondaryPub.name) {
                console.log("primary pub and secondary pub match, skipping");
            } else {
                //create the Secondary Publication
                console.log(`Creating Secondary Publication in Budget for `+secondaryPub.name)
                recordToCreate.fields['Secondary Publication'] = [secondaryPub];
                //these two fields link the Primary to the Secondary for easy Syncing via another automation
                recordToCreate.fields['Primary Record Lookup'] = [{id:primaryRecordId}];
                recordToCreate.fields['Primary Record ID'] = primaryRecordId;

                recordToCreate.fields['Primary Created Time'] = primaryCreatedTime;
                recordToCreate.fields['Secondary check'] = true;
                console.log(recordToCreate.fields)
                
                if (debug == "false") {
                    secondaryId = await slugTable.createRecordAsync(recordToCreate.fields);
                    secondaryIds.push({id: secondaryId});
                } else {
                    console.log("debug set to true, otherwise would have created the secondary record in "+budgetTable);
                }
            }
        }
        if (secondaryIds.length > 0) {
            //update the primary with the secondary Ids
            //this allow for easy Syncing of data to the secondary records
            console.log('updating primary with secondary records');
            console.log(secondaryIds);
            await slugTable.updateRecordAsync(
                primaryRecordId,
                {
                    'Secondary Records': secondaryIds
                }
            );

        }
    }
    console.log(`Created new record in Slugs, removing from Dev table`)
    //remove from the temp table 
    if (debug == "false") {
        //we need to update the secondary pub setting on the original record
        await slugTempTable.updateRecordAsync(thisRecordId,
            {'Secondary Publication': null}
        );

    } else {
        console.log("debug set to true, otherwise would have removed the secondary pub setting in "+txTable);
    }
}
fields = {};

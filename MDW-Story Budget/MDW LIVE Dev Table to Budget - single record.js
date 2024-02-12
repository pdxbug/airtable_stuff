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
* this create the slugTableName 'Budget', slugTempTableName 'Dev Table', slugTablePrimaryFieldName 'Slug',
* it pulls in the record ID and record Name that was just created for quick comparison of values
* sets the debug value false means it will run the slugs into the Budget Table and true means it will only debug
* preventing any records from being created in the Budget Table (very useful for code debugging without creating 
* records that need to be removed later)
*
*/
const {
    slugTableName,
    slugTempTableName,
    slugTablePrimaryFieldName,
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
const slugTable = base.getTable(slugTableName);//Budget
const slugDailyView = slugTable.getView('Created in last day');
const slugTempTable = base.getTable(slugTempTableName);//Dev Table

// load existing records from the DailyView in the Slugs table
// originally we were trying to pull all records, but this changed for two reasons
// 1. When you get over 10k records, it was breaking our 30 second limit
// 2. We only need to pull for today since the auto-slug adds the date and we can only match
//limit to the slug field as we don't need every field in the search
let existingRecords = await slugDailyView.selectRecordsAsync({ fields: [slugTablePrimaryFieldName] });
let mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(existingRecords.records, slugTablePrimaryFieldName);
let newRecord = {id:thisRecordId, name:thisRecordName};
//used for diagnosing problems
console.log(newRecord);
let matchString = newRecord.name;
console.log("Name: "+matchString);

//pull the new record's information from all fields
//we will need to organize the new record's information depending on the columns type
//airtable expects different data formats for Multi-arrays versus text and numbers
//also we will need to pull the Digital/Online Channels into a single field
let queryResult = await slugTempTable.selectRecordAsync(
    newRecord.id,
    {fields: slugTempTable.fields}
);
let thisRecord = queryResult;

// create initial variables
let counter = -1;
let recordsToCreate = [];
let secondaryPubs;
let primaryCreatedTime = '';

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

//go through each column (field), everything will be pushed to the SlugTableName //Budget
for (let field of slugTempTable.fields) {
    //console.log(`Field Name: `+field.name)
    if (
        field.name == "Site Abbrev" ||
        field.name == "Automations complete" ||
        field.name == "Slug" ||
        field.name == "Airtable Record ID" 
    ) {
        //skip due to a field that doesn't exist in Budget table, 
        //or a field that is auto generated in Budget
    } else if (field.name == "Created Time") {
        primaryCreatedTime = thisRecord.getCellValue(field.name);
    } else if (field.name == "Secondary Publication") {
        //get the list of secondary publications to write to
        secondaryPubs = thisRecord.getCellValue(field.name);
        console.log('adding secondary');
        console.log(thisRecord.getCellValue(field.name));
    } else if (field.name == "Other Media") {
        let record = thisRecord.getCellValue(field.name);
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
                    //for now we store them in a list/array;
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
            if (thisRecord.getCellValue(field.name)) {
                console.log(field.name+` found! `)
                fields["Channel ID"] = thisRecord.getCellValue(field.name);
                console.log(fields["Channel ID"])
                DSOsearch = false;
            }
        }
    } else {
        if ((field.name == "Slug" || field.name == "Slug Key") && counter != "-1") {
            //a fix for the slug if there were duplicates
            fields[field.name] = thisRecord.getCellValue(field.name)+'-'+counter;
        } else if (thisRecord.getCellValue(field.name) != null) {
            //all other fields not caught above can just be pushed into the field
            //this assumes that the field in Dev Table is EXACTLY the same as the 
            //field in Budget table (including emojis!)
            fields[field.name] = thisRecord.getCellValue(field.name);
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

function clone(object) {
    var clone ={};
    for( var key in object ){
        if(object.hasOwnProperty(key)) //ensure not adding inherited props
            clone[key]=object[key];
    }
    return clone;
}

console.log(recordsToCreate);
const publicationTable = base.getTable('🔒 Publications');
const publicationTitles = await publicationTable.selectRecordsAsync({fields: ['Publication Title']});
for (let recordToCreate of recordsToCreate) {
    //creating the Primary Publication in Budgets
    if (debug == "false") {
        primaryRecordId = await slugTable.createRecordAsync(recordToCreate.fields);
        console.log('primaryRecordId: '+primaryRecordId);
    } else {
        primaryRecordId = 'debug is true';
        console.log("debug set to true, otherwise would have created the new record in "+slugTableName);
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
        //check for All Midwest/Communities and recreate secondary Pubs
        for (let secondaryPub of secondaryPubs) {
            //checking for All Midwest/Communities
            if (secondaryPub.name == 'All Midwest/Communities') {
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
        //remove the Primary fields from the Secondary Publication
        if (recordToCreate.fields['Channel ID']) {
            delete recordToCreate.fields['Channel ID']
        }
        if (recordToCreate.fields['Primary Site']) {
            delete recordToCreate.fields['Primary Site']
        }
        
        //creating each of the Secondary Publications in Budgets
        let secondaryRecords = [];
        for (let secondaryPub of secondaryPubs) {
            let createThisRecord = recordToCreate;
            if (recordToCreate.fields['Primary Publication'][0].name == secondaryPub.name) {
                console.log("primary pub and secondary pub match, skipping");
            } else {
                //create the Secondary Publication
                console.log(`Creating Secondary Publication in Budget for `+secondaryPub.name);
                console.log(secondaryPub);
                createThisRecord.fields['Secondary Publication'] = [secondaryPub];
                createThisRecord.fields['Primary Record Lookup'] = [{id:primaryRecordId}];
                createThisRecord.fields['Primary Record ID'] = primaryRecordId;
                createThisRecord.fields['Primary Created Time'] = primaryCreatedTime;
                createThisRecord.fields['Secondary check'] = true;
                secondaryRecords.push( {fields: clone(createThisRecord.fields)} );
                console.log(secondaryRecords);
            }
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
                    console.log("debug set to true, otherwise would have created the secondary record in "+slugTableName);
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
}
fields = {};

//let's set to archive and delete records later so we can retrieve them if needed.
console.log(`Created new record in Slugs, removing from Dev table`)
//set to archive from the temp table 
if (debug == "false") {
    slugTempTable.updateRecordAsync(newRecord.id,
        {
            'Automations complete': true
        }
    );
} else {
    console.log("debug set to true, otherwise would have set the new record in "+slugTempTableName+" to archive");
}

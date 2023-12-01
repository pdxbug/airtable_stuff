const {
    slugTableName,
    primaryFieldName,
    slugKey,
    createdTime,
    siteAbbr,
    thisAirtableId,
    debug,
} = input.config();

// helper function
// This creates a map object of primary field and record ID
// example: { FeatureX-AccountY: "recWer23radda" }
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    mapping[existingRecord.getCellValueAsString(fieldName)] = existingRecord.id
  }
  return mapping
}

// get the fields we will be pushing to
const slugTable = base.getTable(slugTableName);
// load all existing records in the Slugs table
const existingRecords = await slugTable.selectRecordsAsync(
    { fields: 
        ['Slug'] 
    });
//console.log(existingRecords)

let slugDate = new Date(createdTime);
let m = slugDate.getMonth() + 1  // 10 (PS: +1 since Month is 0-based)
let d = slugDate.getDate().toString();       // 30
let y = slugDate.getFullYear().toString().slice(-2)   // 20(22)
//slug key sanitization
let slugKeySplit  = slugKey.split(' ');
let cleanSlugKey = '';
for (let slugKeyPart of slugKeySplit) {
    cleanSlugKey = cleanSlugKey + slugKeyPart[0].toUpperCase()+slugKeyPart.slice(1);
}
const slugRegex = /[ .,$%^&*()!@#_]/g;
//console.log(slugKey);
cleanSlugKey = cleanSlugKey.replace(slugRegex, '');
//console.log(cleanSlugKey);

let slug = (siteAbbr.toString().toLowerCase()) + m.toString() + d + y + cleanSlugKey;
console.log(slug);
// create empty arrays
let recordsToCreate = [];
let count = 0;
let counter = 0;
let secondaryPubs;
let recordMatch = false;
let thisSlugKey = slugKey;

function checkForExisting(existingRecords, thisAirtableId, slug) {
    for (const existingRecord of existingRecords.records) {
        if(thisAirtableId != existingRecord.id && slug == existingRecord.getCellValue('Slug')) {
            recordMatch = existingRecord;
            console.log('matching record found');
            return true;
        }
    }
    return false;
}

recordMatch = checkForExisting(existingRecords, thisAirtableId, slug);

if (recordMatch !== false) {
    for (counter = 1; counter < 10; counter++) {
        let tempSlug = slug+'-'+counter;
        recordMatch = checkForExisting(existingRecords, thisAirtableId, tempSlug);
        if (recordMatch === false) {
            slug = tempSlug;
            console.log("Break Match string: "+slug);
            break;
        }
        console.log("Slug already exists: Match string: "+tempSlug);
    }
}

// if theres no match, create the record object making sure Feature and Account is linked
console.log(`This record does not exist, let's fix the slug and check for secondary pubs`)
const fields = {};

let queryResult = await slugTable.selectRecordsAsync({fields: slugTable.fields});
let thisRecord = queryResult.getRecord(thisAirtableId);

for (let field of slugTable.fields) {
    // console.log(`Field Name: `+field.name)
    if ( 
        field.name == "Reporters" || 
        field.name == "Story Budget" ||
        field.name == "Web ETA" ||
        field.name == "Print Pub Date" ||
        field.name == "Notes" ||
        // field.name == "Publish Status" ||
        field.name == "Exclude from WCM" ||
        field.name == "Editing Status" ||
        field.name == "WCM Status" ||
        field.name == "Words (est.)" ||
        field.name == "In Cue?" ||
        field.name == "Published/Scheduled Time" ||
        // field.name == "WCM ID" ||
        field.name == "Words (actual)" ||
        field.name == "Photos" ||
        field.name == "Other Media" ||
        field.name == "Filing deadline" ||
        field.name == "Slug Key" ||
        field.name == "Content Section" ||
        field.name == "Web" ||
        field.name == "Live URL" ||
        field.name == "Photos" ||
        field.name == "Channel ID" ||
        field.name == "Primary Publication" ||
        field.name == "Secondary Publication"
    ) {
        if (field.name == "Secondary Publication") {
            //get the list of secondary publications to write to
            secondaryPubs = thisRecord.getCellValue(field.name);
            // console.log(secondaryPubs);
        } else if (field.name == "Other Media" || field.name == "Created By") {
            //requires a different input from text/numbers/etc
            let record = thisRecord.getCellValue(field.name);
            if (record) {
                record.forEach(function (arrayItem) {
                    delete arrayItem.id;
                });
                fields[field.name] = record;
            }
        } else {
            if (field.name == "Slug Key" && counter > 0) {
                fields[field.name] = thisRecord.getCellValue(field.name) + counter;
                thisSlugKey = slugKey + '-' + counter;
            } else {
                // console.log(field.name + `: newRecord value `+record.getCellValue(field.name))
                fields[field.name] = thisRecord.getCellValue(field.name);
            }
        }
    }
}

recordsToCreate.push({
    fields
});

count = 0;
console.log(`recordsToCreate:`);
console.log(recordsToCreate);
for (let recordToCreate of recordsToCreate) {
    //creating the Primary Publication in Budgets
    if (debug == "false") {
        //update the santized slug
        await slugTable.updateRecordAsync(thisAirtableId, {
            'Slug Key': thisSlugKey,
            'Secondary Publication': null,
            'Sanitized': true
        });
        count = count + 1;
    } else {
        console.log("debug set to true, otherwise would have updated Slug to "+slug+" in  "+slugTableName);
    }

    //secondary publications
    if (secondaryPubs) {
        //check for All Texas and recreate secondary Pubs
        for (let secondaryPub of secondaryPubs) {
            //checking for all texas
            if (secondaryPub.name == 'All Texas') {
                let newSecondaryPubs = [];
                //we need to grab all the publications and set into secondaryPubs
                const publicationTable = base.getTable('Publications');
                const publicationTitles = await publicationTable.selectRecordsAsync({fields: ['Publication Title']});
                console.log(recordToCreate.fields['Primary Publication'][0])
                for (let publicationTitle of publicationTitles.records) {
                    if (publicationTitle.name != 'All Texas' && publicationTitle.name != recordToCreate.fields['Primary Publication'][0].name ) {
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
        // if (recordToCreate.fields['Channel Code']) {
        //     delete recordToCreate.fields['Channel Code']
        // }
        //remove the WCM ID from Secondary Pubs
        if (recordToCreate.fields['WCM ID']) {
            console.log('removed WCM ID for Secondary pub')
            delete recordToCreate.fields['WCM ID']
        }
        
        let secondaryIds = [];
        //creating each of the Secondary Publications in Budgets
        for (let secondaryPub of secondaryPubs) {
            let secondaryId = '';
            //create the Secondary Publication
            console.log(`Creating Secondary Publication in Budget for secondaryPubs.name`)
            recordToCreate.fields['Secondary Publication'] = [secondaryPub]
            recordToCreate.fields['Primary Record Lookup'] = [{id:thisAirtableId}];
            recordToCreate.fields['Primary Record ID'] = thisAirtableId;
            recordToCreate.fields['Primary Created Time'] = slugDate;
            recordToCreate.fields['Secondary check'] = true;
            console.log(recordToCreate.fields)

            if (debug == "false") {
                secondaryId = await slugTable.createRecordAsync(recordToCreate.fields);
                secondaryIds.push({id: secondaryId});
                count = count + 1;
            } else {
                console.log("debug set to true, otherwise would have created the secondary record in "+slugTableName);
            }
        }
        if (secondaryIds.length > 0) {
            //update the primary with the secondary Ids
            console.log('updating primary with secondary records');
            console.log(secondaryIds);
            await slugTable.updateRecordAsync(
                thisAirtableId,
                {
                    'Secondary Records': secondaryIds
                }
            );

        }
    }
    console.log(`Created `+ count +` new record(s)`)
}

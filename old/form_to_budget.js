const {
    slugTableName,
    slugTempTableName,
    slugTablePrimaryFieldName,
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
const slugTempTable = base.getTable(slugTempTableName);
const newRecords = await slugTempTable.selectRecordsAsync({fields: slugTempTable.fields});
// console.log(newRecords.records.length)

// load all existing records in the Slugs table
const existingRecords = await slugTable.selectRecordsAsync({ fields: slugTable.fields });
//console.log(existingRecords)

// create the mapping using the helper function above
const mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(existingRecords.records, slugTablePrimaryFieldName);
//console.log(mapOfUniqueIdToExistingRecordId)

// create empty arrays
let recordsToCreate = [];
let count = 0;

const newRecord = newRecords.records[0] 
//console.log(newRecord);

if (newRecords.records.length == 0) {
    console.log("No new records, abort");
} else {
    const matchString = newRecord.getCellValueAsString(slugTablePrimaryFieldName);
    //console.log("Match string: "+matchString);
    const recordMatch = mapOfUniqueIdToExistingRecordId[matchString];

    // if theres no match, create the record object making sure Feature and Account is linked
    if (recordMatch === undefined) {
        console.log(`This record does not exist, let's create it`)
        const fields = {};
        var DSOsearch = true;

        for (let field of slugTempTable.fields) {
            // console.log(`Field Name: `+field.name)
            if (field.name == "Slug Key" || field.name == "Submission Date" || field.name == "Site Abbrev" || field.name == "Secondary Publication(s)") {
                //skip
            } else if (field.name == "Other Media") {
                //requires a different input from text/numbers/etc
                let queryResult = await slugTempTable.selectRecordsAsync({fields: [field.name]});
                let records = queryResult.records[count];
                let record = records.getCellValue(field.name);
                if (record) {
                  record.forEach(function (arrayItem) {
                      delete arrayItem.id;
                  });
                  fields[field.name] = record;
                }
            } else if (field.name.indexOf("Digital Section") != -1) {
                if (DSOsearch) {
                    //we will need to go through all the Digital Sections to find the one that is filled.
                    let DSO = ["HOU","SAEN"]
                    for (const option of DSO) {
                        
                        let queryResult = await slugTempTable.selectRecordsAsync({fields: ["Digital Section - "+option]});
                        let record = queryResult.records[count];
                        if (record) {
                            //console.log(`Digital Section - `+option+` found! `+record)
                            fields["Channel Code"] = record.getCellValue("Digital Section - "+option);
                            DSOsearch = false;
                            break;
                        }
                    }
                }
            } else {
                let queryResult = await slugTempTable.selectRecordsAsync({fields: [field.name]});
                let record = queryResult.records[count];
                // console.log(field.name + `: newRecord value `+record.getCellValue(field.name))
                fields[field.name] = record.getCellValue(field.name);
            }
        }

        recordsToCreate.push({
            fields
        });
        count = count + 1;
    } else {
        console.log(`Slug '`+matchString+`' already exists as ${recordMatch} in Slugs - deleting from Dev table`)
        //remove fromt the temp table (this should already be completed after the record is sent to the Slugs table)
        await slugTempTable.deleteRecordAsync(newRecords.records[0]);
    }

    console.log(recordsToCreate);
    // loop through and create records in batches of 50
    while (recordsToCreate.length > 0) {
        await slugTable.createRecordsAsync(recordsToCreate.slice(0,50));
        recordsToCreate = recordsToCreate.slice(50);
        console.log(`Created new record in Slugs, removing from Dev table`)
        //remove fromt the temp table 
        await slugTempTable.deleteRecordAsync(newRecords.records[0]);
    }
}

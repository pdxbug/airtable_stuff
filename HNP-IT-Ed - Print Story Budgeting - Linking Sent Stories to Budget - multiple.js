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

let inputConfig = input.config();
let thisWcmId = `${inputConfig.thisWcmId}`;
let thisRecord = `${inputConfig.thisRecordId}`;
//console.log(mapOfUnassignedRecords);

let budgetTable = base.getTable('WCM to Cue Print Budgeting');
let unassignedView = budgetTable.getView("All");
let unassignedBudgetItems = await unassignedView.selectRecordsAsync({fields: ["WCM ID"]});
let mapOfUnassignedBudgetItems = createMappingOfUniqueFieldToRecordId(unassignedBudgetItems.records, 'WCM ID');


let wcmToCueTable = base.getTable('Stories WCM to Cue');
let toBeMatched = wcmToCueTable.getView("To be matched");
let recordsToBeMatched = await toBeMatched.selectRecordsAsync({fields: ["WCMID"]});

for(let record of recordsToBeMatched.records) {
  let wcmIdToMatch = `${record.getCellValue("WCMID")}`;
  if(mapOfUnassignedBudgetItems[wcmIdToMatch]) {
    await wcmToCueTable.updateRecordAsync(record.id, {"WCM to Cue Print Budgeting":[{id:mapOfUnassignedBudgetItems[wcmIdToMatch]}]});
    console.log('Found and Linked');
  }
}

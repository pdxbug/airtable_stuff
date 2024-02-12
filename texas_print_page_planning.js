//most filters are set in the view it is watching, check there first if other filters need to be set
//this should only suggest templates and update under specific conditions

let inputConfig = input.config();

let debug = `${inputConfig.debug}`;
let thisRecordId = `${inputConfig.thisRecordId}`;
let thisTemplateFormula = `${inputConfig.templateFormula}`;
let thisXmlStatus = `${inputConfig.thisXmlStatus}`;
let standardEnrichment = `${inputConfig.standardEnrichment}`;
let thisTemplateStatus = `${inputConfig.templateStatus}`;
let thisTemplateList = `${inputConfig.templateList}`;
let thisPreviousTemplate = `${inputConfig.thisPreviousTemplate}`;
let thisEditorialSpace = `${inputConfig.thisEditorialSpace}`;

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
let templatesTable = await base.getTable("Templates");
let templates = await templatesTable.selectRecordsAsync({ 
  fields: ["Name"],
    sorts: [
       {field: "Priority Order"},
       {field: "Name"},
    ] 
  });
//console.log(templates);
let mapOfUniqueIdToTemplates = createMappingOfUniqueFieldToRecordId(templates.records, "Name");

let pageTable = await base.getTable("Layout");
let templateStatus = null;
let previousTemplateStatus = null;

//console.log(mapOfUniqueIdToTemplates);
let templateFormula = `${inputConfig.templateFormula}`;
templateFormula = templateFormula.replace('*','.*');
const regex = new RegExp(templateFormula,"i");
//console.log(regex);

let recommendedTemplate = "❌No Match";
let suggestedTemplate = "recOBInjidUGXa0DY";//❌No Match
for (const key in mapOfUniqueIdToTemplates) {
    const found = key.match(regex);
    if (found !== null) {
      //find the first match and suggest it, may need to set up priority ordering
      console.log("Template match found for "+regex+" suggesting: "+found);
      recommendedTemplate = key;
      suggestedTemplate = mapOfUniqueIdToTemplates[key];
      break;
    }
}
console.log("Plan Enrich: "+standardEnrichment);
console.log("Template Status: "+thisTemplateStatus);
console.log("Suggested Template: "+recommendedTemplate);

let update;
//ads only first
if (thisEditorialSpace == 'AdsOnly') {
  console.log('AdsOnly');
  //this will be removed from the recommend template view
  update = {
      'Recommended Template': 'AdsOnly',
      'Template List': [{id:'rec4cPxFaLVI4dsZR'}], //AdsOnly
      'Template Status': {name: "LOCKED"}, 
      'Previous Template Status': "LOCKED", 
      'Previous Template': [{id:'rec4cPxFaLVI4dsZR'}], 
      'XML Status': {name: "No Action"}, 
  };
} else if (
  standardEnrichment != "null" &&
  thisTemplateStatus == "null"
) {
//enriched pages second
  //this will be removed from the recommend template view
  console.log('Plan Enrich');
  update = {
      'Recommended Template': 'Plan Enrich',
      'Template List': [{id:'recaFzxWVMDO3frVj'}], //Plan Enrich
      'Template Status': {name: "LOCKED"}, 
      'Previous Template Status': "LOCKED", 
      'Previous Template': [{id:'recaFzxWVMDO3frVj'}], 
      'XML Status': {name: "No Action"}, 
  };
} else if (
  thisTemplateStatus == "null"
)
{
  //update the recommendation and push into template list  
  console.log('Recommending and pushing template to list');
  update = {
      'Recommended Template': recommendedTemplate,
      'Template List': [{id: suggestedTemplate}], //Plan Enrich
      'Previous Template': [{id: suggestedTemplate}], 
  };
} else {
  //update the recommendation only
  console.log('Recommending template only');
  update = {
      'Recommended Template': recommendedTemplate,
  };
} 

if (update) {
  pageTable.updateRecordAsync(
    thisRecordId,
    update
  );
} else {
  console.log('nothing to update');
}

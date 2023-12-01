//this script will take new records entered in the Weather Slack view of Combined, Pubbed 1 Week
//and post content to Slack in the #hnp_weather_chronfeed channel
//it will then update the Sent to Slack field to remove it from view
let inputConfig = input.config();
let thisSlug = `${inputConfig.thisSlug}`;
let thisHeadline = `${inputConfig.thisHeadline}`;
let thisURL = `${inputConfig.thisURL}`;
let thisReporters = `${inputConfig.thisReporters}`;
let thisWcmId = `${inputConfig.thisWcmId}`;
let thisPub = `${inputConfig.thisPub}`;
let thisRecordId = `${inputConfig.thisRecordId}`;

//channel
//hnp_weather_chronfeed
//webhook
//https://hooks.slack.com/services/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

//create the data
let data = {}
 data.fallback = "Weather Story Posted for "+thisPub+" - "+thisSlug;
 data.pretext = "Weather story posted "+thisSlug;
 data.title = "Weather Story Posted for "+thisPub;
 data.link = thisURL;
 data.text = thisHeadline+" : Reporter(s): "+thisReporters;
 data.color = "#e8e8e8";
 data.footer = thisPub+" - "+thisSlug+" - "+thisReporters;
 //data.footer_icon = "";
 data.ts = new Date().getTime();

console.log(data);

fetch("https://hooks.slack.com/services/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", {
  method: "POST",
  body: JSON.stringify({
    "attachments": [data]
  }),
  headers: {
    "Content-type": "application/json; charset=UTF-8"
  }
});

let table = base.getTable("Combined, Pubbed 1 Week");
await table.updateRecordAsync(thisRecordId, {
    "Sent to Slack": true,
})

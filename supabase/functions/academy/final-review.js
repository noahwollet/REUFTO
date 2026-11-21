// Record actual agency-administered assessments; never invent a pass or clinical test.
export function finalReviewAction({a,p,d,c,b,readiness,independentAdmin,need,textValue,now,today,version}){
 if(!['record-final-testout','second-review-testout','release-testout'].includes(b.action))return false;
 independentAdmin(c,a,p);const ready=readiness(d,p,c);
 need(ready.eligible,ready.blockers.join(' ')||'Complete the training gates first.',409);
 if(b.action==='record-final-testout'){
  need(!d.release,'This training record is finalized.',409);const verified={};
  for(const kind of ['written','practical']){const x=b[kind];need(x&&['Pass','Needs further training'].includes(x.result),'Record the actual written and practical results.');need(/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date<=today(),'Record the actual assessment dates.');need(d.attachments.some(f=>f.id===x.fileId&&f.scope==='admin-final-test'),'Attach the completed assessment evidence.');verified[kind]={passed:x.result==='Pass',result:x.result,date:x.date,instrument:textValue(x.instrument,'Assessment title and version',500),reference:textValue(x.reference,'Assessment evidence reference',1000),fileId:x.fileId,at:now(),by:a.email,name:a.name};}
  need(b.attest===true,'Confirm you verified the actual completed assessments.');d.finalTestHistory||=[];if(d.finalTest)d.finalTestHistory.push(d.finalTest);d.finalTest={...verified,id:crypto.randomUUID(),by:a.email,name:a.name,at:now(),notes:textValue(b.notes,'Assessment review notes'),secondReview:null};
 }else if(b.action==='second-review-testout'){
  need(d.finalTest,'Record the test-out results first.',409);need(a.email!==d.finalTest.by,'A different Admin must provide the second review.',403);need(['Approve','Return'].includes(b.decision),'Choose Approve or Return.');need(b.attest===true,'Confirm you read the assessment evidence.');d.finalTest.reviewHistory||=[];if(d.finalTest.secondReview)d.finalTest.reviewHistory.push(d.finalTest.secondReview);d.finalTest.secondReview={by:a.email,name:a.name,at:now(),decision:b.decision,notes:textValue(b.notes,'Second-review notes')};
 }else{
  const t=d.finalTest;need(!d.release,'Final release is already recorded.',409);need(c.adoption?.version===version,'An Admin must record adoption of the current program before independent-duty release.',409);need(t?.written?.passed&&t?.practical?.passed,'Both actual final assessments must be passed.',409);need(t.secondReview?.decision==='Approve'&&t.secondReview.by!==t.by,'An independent second Admin must approve the assessment evidence.',409);need(/^\d{4}-\d{2}-\d{2}$/.test(b.effectiveDate),'Choose the effective release date.');need(b.attest===true,'Confirm the final release decision.');
  d.release={id:crypto.randomUUID(),version,by:a.email,name:a.name,at:now(),effectiveDate:b.effectiveDate,clinicalApproval:textValue(b.clinicalApproval,'Required clinical approval reference',1000),operationalApproval:textValue(b.operationalApproval,'Operational approval reference',1000),notes:textValue(b.notes,'Final release notes'),restrictions:typeof b.restrictions==='string'?b.restrictions.trim().slice(0,2000):'',testoutId:t.id,readiness:ready,snapshot:structuredClone(d)};
 }
 return true;
}

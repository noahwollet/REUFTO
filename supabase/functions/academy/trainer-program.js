export const TRAINER_BANK_KEY='academy/trainer-exam.json';
export async function trainerBank(env){const f=await env.BUCKET.get(TRAINER_BANK_KEY);return f?await f.json():null}
export function trainerVisible(t,admin=false){if(admin)return structuredClone(t);return {email:t.email,version:t.version,lessons:t.lessons||{},attendance:t.attendance||0,mentoredShifts:t.mentoredShifts||[],teachingPassed:!!t.teachingPassed,evaluationPassed:!!t.evaluationPassed,appointment:t.appointment?{expires:t.appointment.expires,at:t.appointment.at}:null,examAttempts:(t.examAttempts||[]).map(e=>({id:e.id,at:e.at,status:e.review?.decision||'Awaiting Admin review'})),activeExam:t.activeExam?{id:t.activeExam.id,startedAt:t.activeExam.startedAt}:null}}
export function writtenApproved(t){const latest=(t.examAttempts||[]).at(-1);return !!latest?.id&&latest.review?.decision==='Approved'&&latest.review.passed===true}
const safeQuestion=q=>({id:q.id,number:q.number,prompt:q.prompt,options:q.options});
const safeCase=q=>({id:q.id,number:q.number,title:q.title,prompt:q.prompt});
export function activeTrainerExam(t){const e=t.activeExam;return e?{id:e.id,startedAt:e.startedAt,title:e.bank.title,instructions:e.bank.instructions,questions:e.bank.questions.map(safeQuestion),cases:e.bank.cases.map(safeCase),answers:e.answers||{},responses:e.responses||{},signature:e.signature||''}:null}
export function trainerSummary(t,modules){const complete=modules.every(m=>t.lessons?.[m.id]),latest=(t.examAttempts||[]).at(-1);return {course:complete?'Lessons completed':'Course incomplete',test:t.activeExam?'In progress':latest?latest.review?.decision||'Awaiting Admin review':'Not submitted',approval:t.appointment?.expires>=new Date().toISOString().slice(0,10)?'Approved FTO':writtenApproved(t)?'Written test approved — practical requirements pending':'Not approved to train',completedModules:modules.filter(m=>t.lessons?.[m.id]).length,totalModules:modules.length}}
export async function trainerAction({env,t,a,email,b,modules,need,now}){
 const own=a.role==='trainer'&&a.email===email;
 if(b.action==='start-written'){
  need(own,'The trainer must take their own test.',403);need(modules.every(m=>t.lessons[m.id]),'Complete each course lesson before starting the written test.',409);
  if(t.activeExam)return {exam:activeTrainerExam(t)};
  const last=t.examAttempts.at(-1);need(!last||t.retakeAuthorization,'An Admin must authorize another attempt after reviewing the last submission.',409);
  const bank=await trainerBank(env);need(bank?.questions?.length===30&&bank?.cases?.length===5,'The written test is not available. Contact an Admin.',409);
  t.activeExam={id:crypto.randomUUID(),startedAt:now(),bank:structuredClone(bank),answers:{},responses:{}};t.retakeAuthorization=null;t.appointment=null;return {exam:activeTrainerExam(t)};
 }
 if(['save-written','submit-written'].includes(b.action)){
  need(own,'The trainer must complete their own test.',403);const e=t.activeExam;need(e&&e.id===b.attemptId,'This test is no longer active. Refresh the page.',409);
  const answers={},responses={};for(const q of e.bank.questions){const v=b.answers?.[q.id];if(v!==undefined){need(Number.isInteger(v)&&v>=0&&v<4,'Choose a valid answer.');answers[q.id]=v}}
  for(const q of e.bank.cases){const v=String(b.responses?.[q.id]||'');need(v.length<=8000,'Case responses must be 8,000 characters or fewer.');responses[q.id]=v}
  e.answers=answers;e.responses=responses;e.signature=String(b.signature||'').trim().slice(0,150);e.savedAt=now();
  if(b.action==='save-written')return {savedAt:e.savedAt};
  need(e.bank.questions.every(q=>Number.isInteger(answers[q.id]))&&e.bank.cases.every(q=>responses[q.id].trim()),'Answer every question and written case.');need(b.declaration===true&&e.signature,'Sign the independent-work declaration.');
  const mcPoints=e.bank.questions.filter(q=>answers[q.id]===q.correct).length,mcCritical=e.bank.questions.filter(q=>q.critical).every(q=>answers[q.id]===q.correct);
  t.examAttempts.push({id:e.id,at:now(),startedAt:e.startedAt,bank:e.bank,answers,responses,signature:e.signature,declaration:true,mcPoints,mcCritical,review:null});t.activeExam=null;return {submitted:true,message:'Your test was submitted for Admin review. Your grade is visible only to Admins.'};
 }
 if(b.action==='review-written'){
  need(a.role==='admin'&&a.email!==email,'Another Admin must review this trainer’s test.',403);const e=t.examAttempts.find(x=>x.id===b.attemptId);need(e?.bank,'Choose an online written test submission.');need(t.examAttempts.at(-1).id===e.id,'Review the latest attempt.',409);need(['Approved','Not approved'].includes(b.decision),'Choose an approval decision.');
  const caseResults=[];for(const q of e.bank.cases){const values=b.caseMarks?.[q.id];need(Array.isArray(values)&&values.length===4&&values.every(v=>typeof v==='boolean'),'Score every written-case criterion.');caseResults.push({id:q.id,marks:values,points:values.filter(Boolean).length,criticalPassed:q.rubric.every((r,i)=>!r.critical||values[i])})}
  const points=e.mcPoints+caseResults.reduce((n,x)=>n+x.points,0),criticalPassed=e.mcCritical&&caseResults.every(x=>x.criticalPassed),passed=points>=e.bank.passPoints&&criticalPassed;
  need(b.decision!=='Approved'||passed,'Approval requires at least 40/50 points and every critical requirement.',409);need(typeof b.notes==='string'&&b.notes.trim()&&b.notes.length<=4000,'Record your private review notes.');
  if(e.review){e.reviewHistory||=[];e.reviewHistory.push(e.review)}e.review={by:a.email,at:now(),decision:b.decision,caseResults,points,total:50,criticalPassed,passed,notes:b.notes.trim()};t.appointment=null;return {review:e.review};
 }
 if(b.action==='authorize-retake'){need(a.role==='admin'&&a.email!==email,'Another Admin must authorize reassessment.',403);need(!t.activeExam&&t.examAttempts.length,'Review the prior attempt before authorizing a retake.',409);need(t.examAttempts.at(-1).review,'Review the submitted test first.',409);need(typeof b.notes==='string'&&b.notes.trim(),'Record the reassessment reason.');t.retakeAuthorization={by:a.email,at:now(),notes:b.notes.trim().slice(0,2000)};return {ok:true}}
 return null;
}

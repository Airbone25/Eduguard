import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation, PresentationFile, FileBlob} from '@oai/artifact-tool';

const ROOT='C:/Users/Airbone/Desktop/minor_project';
const TMP=ROOT+'/.presentation-build';
const OUT=ROOT+'/outputs/eduguard-presentation';
const SKILL='C:/Users/Airbone/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const PY='C:/Users/Airbone/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES='C:/Users/Airbone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {makeNativeBulletParagraphs,finalizePresentation}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs'));
const F='Calibri';
const C={navy:'#142C40',teal:'#007F79',mint:'#CDEBE5',bg:'#F6F7F3',white:'#FFFFFF',muted:'#506372',line:'#D3DDDF',amber:'#926300',red:'#A83F49'};
const P=Presentation.create({slideSize:{width:1280,height:720}});
const outline=[];
function text(s,v,x,y,w,h,size=26,color=C.navy,bold=false){const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=v;q.text.style={typeface:F,fontSize:size,color,bold,autoFit:'none'};return q;}
function box(s,x,y,w,h,fill=C.white,border=C.line){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:border,width:1}});}
function bullets(s,items,x,y,w,h,size=26,color=C.navy){const q=text(s,'',x,y,w,h,size,color);q.text=makeNativeBulletParagraphs(items,{marginLeftPoints:17,hangingPoints:10,spaceAfterPoints:11});q.text.style={typeface:F,fontSize:size,color,autoFit:'none'};return q;}
function conn(s,a,b,from='right',to='left',color=C.teal,both=false){return s.shapes.connect(a,b,{kind:'straight',fromSide:from,toSide:to,line:{fill:color,width:2},head:{type:both?'arrow':'none'},tail:{type:'arrow',width:'med',length:'med'}});}
function diagramNode(s,heading,sub,x,y,w,h=112,fill=C.white){const q=box(s,x,y,w,h,fill);text(s,heading,x+16,y+14,w-32,36,26,C.navy,true);text(s,sub,x+16,y+55,w-32,h-60,21,C.muted);return q;}
function slide(title,subtitle,points,visual,notes,sources=[],dark=false){
 const s=P.slides.add();s.background.fill=dark?C.navy:C.bg;const fg=dark?C.white:C.navy;
 text(s,title,56,38,1168,65,42,fg,true);text(s,subtitle,58,108,1160,47,23,dark?C.mint:C.muted);
 text(s,`${String(P.slides.items.length).padStart(2,'0')}`,1180,672,44,25,17,dark?C.mint:C.muted);
 s.speakerNotes.textFrame.setText(`Speaker notes\n${notes}\n\nVisual / diagram suggestion\n${visual}\n\nSources\n${sources.join('\n')||'User-supplied EduGuard project brief.'}`);
 outline.push({title,subtitle,points,visual,notes,sources});return s;
}
function table(s,values,x,y,width,height,widths,size=22){const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width,height,columnWidths:widths,values});t.borders.assign({fill:C.line,width:1,style:'solid'});for(let r=0;r<values.length;r++){t.rows[r].height=height/values.length;for(let c=0;c<values[0].length;c++){const cell=t.getCell(r,c);cell.fill=r===0?C.navy:(r%2?C.white:'#EDF3F1');cell.text.style={typeface:F,fontSize:size,color:r===0?C.white:C.navy,bold:r===0,autoFit:'none'};}}t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({margins:{left:12,right:12,top:10,bottom:8},anchor:'center'});return t;}
const refs={
 ews:'Balfanz, R., Herzog, L., & Mac Iver, D. J. (2007). Preventing student disengagement and keeping students on the graduation path in urban middle-grades schools: Early identification and effective interventions. Educational Psychologist, 42(4), 223–235. https://doi.org/10.1080/00461520701621079',
 edm:'Baker, R. S. J. d., & Yacef, K. (2009). The state of educational data mining in 2009: A review and future visions. Journal of Educational Data Mining, 1(1), 3–17. https://doi.org/10.5281/zenodo.3554657',
 survey:'Romero, C., & Ventura, S. (2020). Educational data mining and learning analytics: An updated survey. WIREs Data Mining and Knowledge Discovery, 10(3), e1355. https://doi.org/10.1002/widm.1355',
 ethics:'Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and dilemmas. American Behavioral Scientist, 57(10), 1510–1529. https://doi.org/10.1177/0002764213479366',
 unesco:'Miao, F., Holmes, W., Huang, R., & Zhang, H. (2021). AI and education: Guidance for policy-makers. UNESCO. https://doi.org/10.54675/PCSP7350'
};

// 01 Cover: full project title, editable identification fields.
{
 const title='EduGuard: Early-Warning Academic-Risk Detection and Intervention Platform for Schools';
 const s=slide('EduGuard','Undergraduate Minor Project Evaluation', ['Educational Data Mining and Machine Learning','Full-Stack Multi-Tenant Web Systems'], 'Minimal navy title slide with an editable project title and presenter details.', 'EduGuard connects weekly academic observations with teacher review and trackable support. Its central design principle is to keep risk advisory and teacher-facing while giving students a positive view of their progress.',[],true);
 s.shapes.items[0].text='EduGuard';s.shapes.items[0].text.style={typeface:F,fontSize:72,color:C.white,bold:true,autoFit:'none'};s.shapes.items[0].position={left:58,top:66,width:1150,height:95};
 s.shapes.items[1].position={left:60,top:30,width:1120,height:30};s.shapes.items[1].text.style={typeface:F,fontSize:20,color:C.mint,autoFit:'none'};
 text(s,'Early-Warning Academic-Risk Detection\nand Intervention Platform for Schools',60,183,1160,150,43,C.white,true);
 bullets(s,['Educational Data Mining and Machine Learning','Full-Stack Multi-Tenant Web Systems'],64,379,1100,105,25,C.mint);
 text(s,'Candidate: [Candidate name]\nSupervisor: [Supervisor name]',60,549,570,86,23,C.white);
 text(s,'Institution: [Institution name]\nAcademic year: [Academic year]',655,549,565,86,23,C.white);
 outline[0].title=title;
}
// 02 Abstract and closed-loop workflow.
{
 const pts=['Weekly observations reveal changing academic patterns before final outcomes.','EduGuard combines longitudinal prediction with teacher review and recorded support.','Follow-up observations help teachers review progress after an intervention.'];
 const s=slide('Introduction and abstract','A closed loop linking early signals to educator action',pts,'Five connected stages with a follow-up return path beneath them.','Early-warning research links longitudinal indicators with opportunities for timely support. EduGuard implements that idea as a complete workflow in which teachers interpret signals, act, and review subsequent progress.',[refs.ews,refs.edm]);
 bullets(s,pts,62,177,1120,158,27);
 const labels=[['Weekly data','Attendance,\nscores, submissions'],['40 features','Trends, variability\nand streaks'],['Risk prediction','Serialized logistic\nregression pipeline'],['Explainability','Measured signals\nfor teacher review'],['Intervention','Create, track\nand follow up']];
 const ns=labels.map((v,i)=>diagramNode(s,v[0],v[1],58+i*239,370,215,135,i===4?C.mint:C.white));for(let i=0;i<4;i++)conn(s,ns[i],ns[i+1]);
 s.shapes.connect(ns[4],ns[0],{kind:'elbow',fromSide:'bottom',toSide:'bottom',line:{fill:C.teal,width:2},tail:{type:'arrow',width:'med',length:'med'}});
 text(s,'Subsequent weekly observations support intervention review',224,556,835,44,27,C.teal,true);
 text(s,'Prediction advises the teacher. It does not automatically determine an action.',180,614,965,32,22,C.muted);
}
// 03 Problem / relevance.
{
 const pts=['Reactive support starts after visible failure or disengagement.','A single grade hides direction, volatility and repeated missed work.','Fragmented records separate evidence from intervention follow-up.','Student-facing risk labels can undermine privacy and encourage fixed judgments.'];
 const s=slide('Problem statement and relevance','Schools need timely evidence and a responsible path to action',pts,'Four paired rows linking an existing problem to EduGuard’s design response.','The problem is both analytical and operational: schools need to notice change and coordinate a response. The student experience also matters, because predictive labels can create stigma when treated as fixed judgments.',[refs.ews,refs.ethics]);
 table(s,[['Problem','EduGuard response'],['Late, reactive intervention','Weekly monitoring and advisory support signals'],['Snapshot grading','Temporal features over student history'],['Disconnected academic records','Unified observation and intervention workflow'],['Potential student stigmatization','Positive progress views with no risk labels']],58,190,1164,360,[420,744],25);
 bullets(s,['Project contribution: connect detection, explanation and a recorded educator response.'],63,593,1150,60,26);
}
// 04 SMART objectives.
{
 const pts=['By evaluation, demonstrate school isolation with composite school_id relationships and rejected cross-tenant access.','By evaluation, derive the fixed 40-feature contract from dated weekly records with deterministic missing-data handling.','By evaluation, validate the serialized pipeline and map teacher-only probabilities to the three stated risk bands.','By evaluation, demonstrate intervention creation, status updates and a reviewable timeline in the teacher portal.','By evaluation, demonstrate student progress, streaks and supportive actions with zero risk fields in student responses.'];
 const s=slide('Objectives of the project work','Five SMART acceptance targets for the minor-project evaluation',pts,'Five numbered objectives, each with a concrete demonstration or acceptance condition.','Each objective has a defined evaluation deadline and an observable acceptance condition. Together they cover tenant isolation, repeatable inference, teacher action, and a protected student experience.');
 const short=[['School isolation','Demonstrate tenant-scoped access and rejected cross-school relationships.'],['40 temporal features','Produce deterministic, dated features with explicit missing-data handling.'],['Advisory inference','Validate the saved pipeline and apply three teacher-only risk bands.'],['Intervention tracking','Demonstrate creation, status updates and a reviewable timeline.'],['Student progress privacy','Show progress and supportive actions with zero risk fields in student responses.']];
 short.forEach((v,i)=>{const y=182+i*86;text(s,String(i+1).padStart(2,'0'),60,y,70,44,36,C.teal,true);text(s,v[0],153,y,1045,35,27,C.navy,true);text(s,v[1],153,y+36,1060,42,23,C.muted);});
 text(s,'Deadline for all five targets: minor-project evaluation',154,636,1035,30,21,C.teal,true);
}
// 05 Literature and requirements.
{
 const pts=['Functional: ingest weekly records, predict, explain and track interventions.','Non-functional: tenant isolation, role privacy, repeatability, responsiveness and testability.'];
 const s=slide('Requirements and literature survey','Selected EWS and EDM research informs the system requirements',pts,'Editable comparison table above two concise requirement groups.','Longitudinal monitoring and intervention are established ideas in early-warning research. EduGuard’s contribution is their integration with tenant-safe storage and a deliberately restricted student view, rather than a claim that all existing systems lack these capabilities.',[refs.ews,refs.edm,refs.survey,refs.ethics]);
 table(s,[['Dimension','Selected EWS / EDM literature','EduGuard implementation'],['Longitudinal tracking','Established in early-warning research¹','Weekly records and 40 temporal features'],['Multi-tenancy','Not established by these research sources','Composite school_id relationships'],['Closed-loop support','Identification + intervention emphasized¹','Creation, timeline and progress review'],['Privacy-first student view','Ethical concern in learning analytics²','Risk-free student response schemas']],58,181,1164,307,[235,448,481],21);
 text(s,'Functional requirements',60,512,545,38,26,C.teal,true);text(s,'Non-functional requirements',657,512,560,38,26,C.teal,true);
 bullets(s,[pts[0].replace('Functional: ','')],65,556,539,84,23);
 bullets(s,[pts[1].replace('Non-functional: ','')],661,556,542,84,23);
 text(s,'¹ Balfanz et al. (2007)    ² Slade & Prinsloo (2013). Comparison concerns the cited research scope.',60,663,1100,26,16,C.muted);
}
// 06 Architecture.
{
 const pts=['API authorization scopes requests by role, school and course assignment.','Composite (school_id, entity_id) foreign keys reject cross-school relationships.','Database integrity complements application authorization in a shared database.'];
 const s=slide('System design and architecture','Three layers with shared-database tenant integrity',pts,'Editable three-tier architecture with the scikit-learn pipeline attached to the service layer.','React presents role-specific workflows while FastAPI validates and authorizes requests before accessing school-scoped data. Composite tenant foreign keys prevent invalid cross-school relationships, while the API remains responsible for restricting reads.',[ROOT+'/01_BACKEND_ARCHITECTURE.md',ROOT+'/backend/app/ml/model_loader.py']);
 const ui=diagramNode(s,'Presentation layer','React 19 SPA\nAdmin / Teacher / Student',58,205,333,151);
 const api=diagramNode(s,'Application layer','FastAPI REST API\nValidation and authorization',454,205,333,151,C.mint);
 const db=diagramNode(s,'Persistence layer','PostgreSQL 16\nTenant-scoped relational data',850,205,372,151);
 conn(s,ui,api,'right','left',C.teal,true);conn(s,api,db,'right','left',C.teal,true);text(s,'HTTPS / JSON',321,164,208,32,19,C.muted);text(s,'SQLAlchemy 2.0',771,164,227,32,19,C.muted);
 const ml=diagramNode(s,'scikit-learn pipeline','Verified serialized artifact for inference',364,414,513,100);conn(s,api,ml,'bottom','top',C.teal,true);
 text(s,'Request + response',59,372,300,29,20,C.muted);text(s,'9 linear Alembic migrations',850,372,355,29,20,C.muted);
 bullets(s,pts,65,555,1151,104,23);
}
// 07 Methodology / model.
{
 const pts=['Build features only from observations available on or before the prediction date.','Verify the artifact checksum, feature ordering, runtime version and threshold metadata.','Evaluate predictive quality separately from software tests before school deployment.'];
 const s=slide('Research methodology and ML pipeline','Dated feature construction and reproducible advisory inference',pts,'Three feature families followed by the native preprocessing pipeline and non-overlapping probability bands.','The implementation uses an eight-week observation window and preserves missing values for the fitted imputer. The risk bands are configured decision rules, and the measured explanation signals do not establish causation or calibrated predictive accuracy.',[ROOT+'/backend/app/ml/feature_builder.py',ROOT+'/backend/app/ml/model_loader.py',ROOT+'/backend/app/services/explanation_service.py']);
 text(s,'40 temporal features',60,176,1130,43,31,C.teal,true);
 table(s,[['Attendance velocity','Assessment dispersion','Submission patterns'],['Slope and four-week change','Variation across weekly averages','On-time rates and late streaks']],58,230,1164,109,[388,388,388],22);
 const a=diagramNode(s,'SimpleImputer','Handle missing values',59,379,348,103);const b=diagramNode(s,'StandardScaler','Apply fitted scaling',466,379,348,103);const c=diagramNode(s,'LogisticRegression','Estimate risk probability',873,379,348,103,C.mint);conn(s,a,b);conn(s,b,c);
 text(s,'Low: p < 0.40',62,511,355,36,26,C.teal,true);text(s,'Medium: 0.40 ≤ p < 0.65',465,511,400,36,26,C.amber,true);text(s,'High: p ≥ 0.65',895,511,321,36,26,C.red,true);
 bullets(s,pts,64,565,1142,107,21);
}
// 08 Technology grid.
{
 const pts=['The stack supports typed interfaces, repeatable database evolution and reproducible model inference.'];
 const s=slide('Tools and technologies used','A typed application stack with explicit data and security boundaries',pts,'A six-category editable technology grid.','The frontend handles role-specific workflows, and FastAPI enforces the data contract at the service boundary. PostgreSQL constraints, model verification and separate backend and frontend tests support reliability.');
 table(s,[['Category','Tools and technologies'],['Frontend','React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4\nshadcn/ui, TanStack Query, Recharts, Zustand'],['Backend','Python 3.12, FastAPI, Pydantic v2'],['Database / ORM','PostgreSQL 16, CITEXT, SQLAlchemy 2.0, Alembic'],['ML / Data','scikit-learn 1.6.1, serialized preprocessing + LogisticRegression'],['Testing / DevOps','PostgreSQL integration tests, Vitest, MSW\nAlembic migration workflow and Vite production build'],['Security','Argon2id password hashing, PyJWT, role and tenant authorization']],58,182,1164,410,[245,919],22);
 bullets(s,pts,62,629,1151,44,22);
}
// 09 Ethics, role split.
{
 const pts=['Risk probabilities and levels remain teacher-facing advisory aids.','Student responses exclude risk scores, labels and disciplinary judgments.','Human review and dated observations reduce deterministic labeling.','Bias prevention requires subgroup evaluation and ongoing monitoring.'];
 const s=slide('Ethical AI and privacy by design','Role-specific information supports care without exposing predictive labels',pts,'A role-partition matrix paired with a clearly marked remaining fairness-validation requirement.','Students see measured progress, streaks and supportive actions, while authorized teachers see advisory risk signals and private intervention details. This design reduces exposure and labeling risks, but fairness requires empirical checks and cannot be guaranteed by hiding scores.',[refs.ethics,refs.unesco,ROOT+'/backend/PROGRESS.md'],true);
 table(s,[['Role','Permitted view','Privacy boundary'],['Admin','School configuration and user management','School-scoped administrative access'],['Teacher','Risk bands, measured signals, intervention timeline','Assigned students and authorized courses'],['Student','Own progress, streaks and visible support actions','No risk probability, label or private notes']],58,184,1164,278,[170,524,470],24);
 bullets(s,['Teacher judgment governs the response. A risk band never determines discipline.','Restrict identity and leakage-prone features in the model contract.'],63,497,1146,91,25,C.white);
 text(s,'Remaining evaluation: calibration, subgroup errors and the effects of interventions',64,625,1135,42,23,C.mint,true);
}
// 10 Progress.
{
 const pts=['Responsive Admin, Teacher and Student portals are complete.','Model verification includes checksum and threshold validation.','Passing software tests do not establish predictive accuracy or intervention effectiveness.'];
 const s=slide('Progress of project work','Current status reported in the project brief',pts,'Completed milestone matrix with separate backend test and frontend suite counts.','The reported implementation covers the backend, three responsive portals and the temporal inference workflow. These figures document engineering progress, while predictive validation and real-school outcomes require separate evidence.');
 table(s,[['Workstream','Completed scope','Reported evidence'],['Backend','M1–M15','60 REST endpoints across 11 modules\n130 PostgreSQL integration tests passing'],['Frontend','M1–M16 and M19','Admin, Teacher and Student portals\n47 Vitest / MSW test suites passing'],['Database','Schema evolution','9 linear Alembic migrations'],['Data / ML','Temporal inference pipeline','40 temporal features\nChecksum and threshold validation']],58,187,1164,344,[221,360,583],24);
 bullets(s,pts,63,570,1142,110,23);
}
// 11 Explicitly requested four layout boxes, not fabricated screenshots.
{
 const pts=['Teacher class risk summary and distribution chart.','Student risk factor breakdown in the teacher portal.','Intervention creation and timeline tracker.','Growth-oriented student dashboard.'];
 const s=slide('Screenshots and working modules','Four interface placeholders for the live demonstration',pts,'Four screenshot layout boxes. Insert actual application captures in the indicated areas before presenting a screenshot-based demonstration.','The demonstration moves from the teacher’s class overview to an individual student’s measured signals, then records and reviews an intervention. The final view switches to the student portal, where only growth and supportive actions appear.');
 const data=[['01  Teacher class risk summary','Class-level distribution chart and prioritized student list.','Teacher portal'],['02  Student risk factor breakdown','Dated attendance and assessment changes with measured explanation signals.','Teacher portal only'],['03  Intervention creation and timeline','Support action, status updates and follow-up history.','Teacher portal'],['04  Growth-oriented student dashboard','Progress trends, on-time streaks and visible supportive action items.','Student portal: no risk scores or labels']];
 data.forEach((v,i)=>{const x=58+(i%2)*594,y=183+Math.floor(i/2)*224;box(s,x,y,570,205,C.white,C.line);text(s,v[0],x+20,y+16,530,42,26,C.navy,true);text(s,v[1],x+20,y+73,526,66,24,C.muted);text(s,v[2],x+20,y+159,526,30,21,C.teal,true);});
 text(s,'Interface placeholders describe the working modules. They are not application screenshots.',60,654,1150,30,19,C.muted);
}
// 12 Future work.
{
 const pts=['v2 stacked ensemble using XGBoost and RandomForest.','Student check-in sentiment NLP classifier.','Google Calendar synchronization for meetings.','Production rate-limiting and password reset.'];
 const s=slide('Work to be done and future scope','Proposed roadmap beyond the current minor-project implementation',pts,'Sequenced roadmap with validation gates separating reliability work from experimental model additions.','The roadmap first strengthens evaluation and deployment readiness, then extends integration and modeling. Any ensemble or sentiment model should demonstrate measurable benefit and meet the same privacy boundaries before release.');
 table(s,[['Sequence','Planned work','Acceptance focus'],['1  Deployment readiness','Production rate-limiting\nPassword reset','Abuse resistance and secure account recovery'],['2  Workflow integration','Google Calendar meeting synchronization','Authorized access and reliable event updates'],['3  Model v2','Stacked XGBoost / RandomForest ensemble','Compare against logistic regression on held-out data'],['4  Student check-ins','Sentiment NLP classifier','Consent, privacy and subgroup error review']],58,182,1164,355,[235,433,496],23);
 bullets(s,['Validation gate: student-separated, time-aware evaluation with precision / recall, calibration and subgroup error checks.','Pilot gate: educator usability and measured follow-up outcomes before broad deployment.'],63,577,1145,99,23);
}
// 13 Full APA bibliography.
{
 const pts=['Early Warning Systems: longitudinal indicators and intervention.','EDM: modeling and analytics foundations.','Ethical AI: privacy, agency and human oversight.'];
 const s=slide('References and bibliography','Academic foundations in EWS, Educational Data Mining and ethical AI',pts,'Five APA-style references in a single readable column, with DOI links retained in the speaker notes.','These references establish the foundations for early-warning indicators, educational data mining and responsible use of learner data. EduGuard applies them through its longitudinal workflow, teacher oversight and restricted student views.',Object.values(refs));
 const short=[refs.edm,refs.ews,refs.unesco,refs.survey,refs.ethics];
 const italic=['Journal of Educational Data Mining, 1','Educational Psychologist, 42','AI and education: Guidance for policy-makers','WIREs Data Mining and Knowledge Discovery, 10','American Behavioral Scientist, 57'];
 const heights=[95,115,90,95,100];let y=178;
 for(let i=0;i<short.length;i++){
  const q=text(s,'',60,y,1158,heights[i],21,C.navy);const v=short[i],start=v.indexOf(italic[i]),url=v.indexOf('https://');
  q.text=[{marginLeft:12*12700,indent:-12*12700,runs:[{run:v.slice(0,start)},{run:italic[i],textStyle:{italic:true}},{run:v.slice(start+italic[i].length,url)},{run:v.slice(url),link:{uri:v.slice(url),isExternal:true}}]}];
  q.text.style={typeface:F,fontSize:21,color:C.navy,autoFit:'none'};y+=heights[i];
 }
}

await fs.writeFile(TMP+'/font-policy.json',JSON.stringify({basis:'design',families:[F]},null,2));
const md='# EduGuard presentation content\n\n'+outline.map((o,i)=>`## Slide ${i+1}: ${o.title}\n\n**Subtitle:** ${o.subtitle}\n\n${o.points.map(p=>'- '+p).join('\n')}\n\n**Visual / diagram suggestion:** ${o.visual}\n\n**Speaker notes:** ${o.notes}\n\n${o.sources.length?'**Sources:**\n\n'+o.sources.map(v=>'- '+v).join('\n')+'\n':''}`).join('\n');
await fs.writeFile(OUT+'/EduGuard_Slide_Content_and_Notes.md',md);
const candidatePath=TMP+'/candidate.pptx';
await (await PresentationFile.exportPptx(P)).save(candidatePath);
console.log('Exported draft');
const finalPath=OUT+'/EduGuard_Minor_Project_Evaluation.pptx';
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,pythonExecutable:PY,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',explicitTotalSlideCount:13,requiredNativeTableOwnerSlides:[3,5,7,8,9,10,12],requiredNativeChartOwnerSlides:[],layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[3,5,7,8,9,10,12].flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[F]},verifyArtifactToolImport:true,receiptPath:TMP+'/validation.json'});
console.log(JSON.stringify(result));
const FINAL=await PresentationFile.importPptx(await FileBlob.load(finalPath));
await fs.mkdir(TMP+'/renders',{recursive:true});
for(let i=0;i<FINAL.slides.items.length;i++){
 const s=FINAL.slides.items[i];
 const preview=await FINAL.export({slide:s,format:'png',scale:1.2});
 await fs.writeFile(TMP+`/renders/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await preview.arrayBuffer()));
 const l=await s.export({format:'layout'});await fs.writeFile(TMP+`/renders/slide-${String(i+1).padStart(2,'0')}.json`,await l.text());
 console.log('Rendered slide '+(i+1));
}

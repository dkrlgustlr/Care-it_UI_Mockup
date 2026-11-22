const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const extras=[
  ' 낮잠 후에는 창밖의 구름을 보면서 모양이 어떻게 바뀌는지 이야기했다. 물병을 다시 채워 달라고 요청했고 물을 마신 다음에는 뚜껑을 닫아 자신의 가방 옆에 두었다. 귀가할 때는 바구니에서 준비물을 한 가지씩 확인하고 보호자에게 인사했다.',
  ' 놀이를 마친 후 색연필을 친구와 함께 통에 넣었다. 친구가 먼저 정리한 그림을 보고 어디에 둘지 물었고 각자 작품을 파일에 넣었다. 귀가를 기다리면서 오늘 즐거웠던 활동을 차분하게 떠올려 이야기하고 선생님에게 손을 흔들었다.',
  ' 추가로 모양이 다른 조각을 살펴보며 어느 면을 붙이면 될지 손으로 짚었다. 완성한 결과물을 책상 위에 올려두고 스스로 다른 색을 골라 작은 표시를 했다. 교사의 질문에 사용한 재료의 이름을 하나씩 말하며 오늘 한 일을 설명했다.',
  ' 이후 물병의 뚜껑이 잘 닫혔는지 확인하고 의자에서 일어났다. 복도에서는 다른 사람이 지나가는 것을 보고 잠시 기다렸다. 신발을 신은 뒤에는 발뒤꿈치 부분을 다시 정리했고 준비가 끝났다고 말한 다음 안내에 따라 문 쪽으로 이동했다.',
  ' 마지막으로 실내화를 제자리에 놓고 가방의 지퍼를 닫았다. 오늘 만든 그림을 어디에 넣었는지 다시 확인해 본 뒤 친구에게 인사했다. 기다리는 동안 창밖을 바라보며 내일은 다른 색으로도 그림을 그려보고 싶다고 이야기했다.'
];
const originals=[
  '가상 사례. 아침에 교실에 들어와 외투 지퍼가 잘 안 풀려 한참 서 있었다. 손잡이를 어디서 잡는지 보여주자 다시 시도했고 끝부분은 혼자 풀었다. 가방을 사물함에 넣고 창가의 화분으로 가서 흙이 말랐다고 말했다. 물뿌리개를 주니 두 화분에 나누어 물을 주고 바닥에 떨어진 물은 휴지로 닦았다. 오전에는 친구들이 만든 기차 길 옆에 블록을 가져다 놓으며 역을 만들고 싶다고 했다. 기차가 다리 밑에서 자꾸 걸리자 블록 높이를 바꿨고 다시 지나가게 했다. 간식으로 사과를 먼저 먹고 우유는 조금 남겼다. 정리 시간이 되자 놀이를 더 하고 싶어 했지만 모래시계가 끝나면 정리하기로 이야기한 뒤 기차를 상자에 넣었다. 산책 중 노란색과 갈색 나뭇잎을 살펴보고 작은 돌을 잠시 만져본 뒤 내려놓았다. 돌아와 손을 씻고 젖은 소매를 걷어 올렸다.',
  '가상 사례. 등원할 때 보호자와 헤어지는 것을 아쉬워해서 문 앞에서 잠깐 손을 잡고 기다렸다. 먼저 와 있던 친구가 인사하자 작게 인사하고 좋아하는 자동차 그림을 보여주면서 자리에 앉았다. 자유놀이 때 친구가 같은 색연필을 사용하려 하자 처음에는 손으로 가렸다. 번갈아 쓰는 방법과 기다리는 동안 다른 색을 고를 수 있다고 알려주니 파란색을 골라 그림을 계속 그렸다. 친구가 색연필을 건네자 고맙다고 말하고 친구 그림에 있는 동물 이름을 물었다. 점심 전 의자가 부딪히자 얼굴을 찡그렸고 소리가 커서 놀랐다고 이야기했다. 조용한 쪽에 잠시 앉았다가 스스로 다시 모임에 참여했다. 오후에는 종이배를 보여주며 선생님이 봐주면 좋겠다고 말했다. 친구의 배를 보면서 자기 배에는 창문이 있다고 설명했고 내일도 같이 놀자고 이야기했다. 마무리할 때는 먼저 손을 흔들었다.',
  '가상 사례. 그림 카드 세 장을 보고 같은 동물을 찾았다. 토끼와 고양이는 바로 짝을 맞췄고 새 그림은 방향이 달라지자 살펴본 뒤 같은 색 부분을 가리켰다. 어떤 점이 비슷한지 묻자 날개가 있다고 대답했다. 숫자 블록으로 탑을 쌓을 때는 크기순으로 놓다가 작은 블록을 중간에서 꺼내 맨 위에 놓았다. 탑이 무너지자 다시 하기 싫다고 말했지만 바닥을 넓혀 보자는 제안에 큰 블록 두 개를 받침으로 사용했다. 그림책을 읽으며 다음 장면을 넘기기 전에 주인공이 어디로 갈지 추측했고 실제 내용과 다르자 앞장을 확인했다. 색종이 접기에서는 모서리를 맞추는 위치를 손가락으로 짚어 주니 선을 따라 접었다. 완성한 배에 이름표를 붙이고 사용한 가위와 풀을 제자리에 두었다. 활동을 마친 뒤 직접 만든 것을 가리키며 다음에도 해보고 싶다고 이야기했다.',
  '가상 사례. 손을 씻으러 이동하면서 소매가 젖지 않도록 걷어 올리자고 이야기했다. 수도꼭지를 열고 비누를 한 번 누른 뒤 손바닥을 문질렀으나 손등을 바로 헹구려 해서 손등도 닦는 모습을 보여주었다. 따라 한 뒤 수건으로 손가락 사이를 닦고 수건을 바구니에 넣었다. 실내 이동 중 바닥에 놓인 가방에 걸릴 수 있다고 알려주니 걸음을 멈추고 가방을 벽 쪽으로 옮겼다. 바깥놀이에서는 계단 손잡이를 잡았고 미끄럼틀 앞에서 앞사람이 내려갈 때까지 기다렸다. 점심에는 국이 뜨겁다고 말해 식힌 뒤 먹도록 안내했고 물을 쏟아 수건으로 닦았다. 오후에는 피곤하다고 하여 조용한 자리에 잠시 앉았다가 다시 활동에 참여했다. 다친 곳은 관찰하지 못했고 기침이나 열을 호소하지 않았다. 귀가 전 뒤집힌 겉옷 소매의 방향을 함께 확인하고 가방을 챙겼다.',
  '가상 사례. 오늘은 교실에 조금 늦게 도착해 첫 활동 안내를 다시 들었다. 새로 배치된 교구함을 둘러본 뒤 만들기 재료가 어디 있는지 물어 함께 확인했다. 종이컵을 옮기다가 하나가 찌그러지자 새것으로 바꾸고 싶다고 요청했고 사용할 것과 버릴 것을 구분해 정리했다. 옆에서 의자를 끄는 소리가 나자 양손으로 귀를 막았으며 소리가 멈춘 뒤 다시 작업을 이어 갔다. 보호자가 전달한 여벌 양말을 가방 안쪽 주머니에 넣고 어디에 두었는지 알려주었다. 그림을 완성한 뒤 사진을 찍고 싶다고 해서 작품 옆에 이름 카드를 놓았고, 사진을 본 다음 게시판에 붙이고 싶다고 말했다. 평소 물병 대신 다른 컵을 사용해도 되는지 확인한 뒤 물을 마셨다. 귀가 준비 때 그림 파일을 빠뜨려 다시 돌아와 챙겼고 내일 가져올 준비물을 그림으로 표시해 달력 옆에 두었다. 보호자에게 오늘 만든 것을 보여주겠다고 말했다.'
].map((text,i)=>(text+extras[i]).slice(0,500));

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:900}});page.setDefaultTimeout(120000);
  const ids=['#journal-raw','#journal-finalSocialEmotional','#journal-finalLearningActivity','#journal-finalHealthSafety','#journal-finalSpecialNotes'];
  try{
    await page.goto('http://127.0.0.1:8767/careit-mockup.html#/journals/new?recipient=0');
    for(let i=0;i<ids.length;i++)await page.locator(ids[i]).fill(originals[i]);
    const before=(await (await page.request.get('http://127.0.0.1:8767/api/local-ai/status')).json()).usage.used;
    await page.locator('.sidebar [data-action="ai-toggle"]').click();await page.waitForTimeout(1000);
    await page.locator('#ai-chat-input').fill('일지기록에 적어둔 멘트들 다듬어줘');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.locator('.ai-chat-message.assistant').last().waitFor();
    await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'),null,{timeout:240000});
    const answer=await page.locator('.ai-chat-message.assistant').last().innerText();
    const after=(await (await page.request.get('http://127.0.0.1:8767/api/local-ai/status')).json()).usage.used;
    const changed=[];for(let i=0;i<ids.length;i++)changed.push((await page.locator(ids[i]).inputValue())!==originals[i]);
    console.log(JSON.stringify({lengths:originals.map(x=>x.length),changed,used:after-before,answer}));
    assert(changed.every(Boolean),answer);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

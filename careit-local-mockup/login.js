(() => {
  const autoLoginKey='careit-mockup-auto-login';
  try { if((!location.hash||location.hash==='#/')&&localStorage.getItem(autoLoginKey)==='1'){location.replace('careit-mockup.html#/');return;} } catch {}
  const card=document.querySelector('.login-card');
  const original=card.innerHTML;
  const reassurance=document.querySelector('.login-reassurance');
  let resendTimer;
  const draft={email:'',name:'케어릿 사용자'};
  const logo='<img class="brand-mark" width="30" height="30" alt="케어릿" src="assets/logo.webp">';
  const escapeHTML=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const field=(id,label,type='text',value='',extra='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escapeHTML(value)}" ${extra}></div>`;
  const showError=(message,input)=>{const error=card.querySelector('.field-error');error.textContent=message;error.hidden=false;input?.focus();};
  const go=route=>{location.hash=`#${route}`;};
  function bindLogin(){
    const form=document.querySelector('#login-form'),email=document.querySelector('#login-email'),password=document.querySelector('#login-password'),error=document.querySelector('#login-error');
    document.querySelector('#show-password').addEventListener('click',event=>{const show=password.type==='password';password.type=show?'text':'password';event.currentTarget.textContent=show?'숨기기':'보기';event.currentTarget.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 보기');});
    form.addEventListener('submit',event=>{event.preventDefault();if(!email.value.trim()||!email.validity.valid||!password.value){error.textContent=!email.value.trim()?'이메일을 입력해 주세요.':!email.validity.valid?'올바른 이메일을 입력해 주세요.':'비밀번호를 입력해 주세요.';error.hidden=false;(!email.value.trim()||!email.validity.valid?email:password).focus();return;}try { if(document.querySelector('#remember-login').checked)localStorage.setItem(autoLoginKey,'1');else localStorage.removeItem(autoLoginKey); } catch {}location.href='careit-mockup.html#/';});
    card.querySelectorAll('[data-social]').forEach(button=>button.addEventListener('click',()=>{const message=document.querySelector('#social-message');message.textContent=`${button.dataset.social} 로그인은 아직 연결되지 않았어요.`;message.hidden=false;}));
  }
  function render(){
    clearInterval(resendTimer);
    const route=location.hash.slice(1),reset=route.startsWith('/password-reset'),signup=route.startsWith('/signup/');
    if(!reset&&!signup){card.innerHTML=original;reassurance.hidden=false;document.title='로그인 · 케어릿';bindLogin();return;}
    const base=reset?'/password-reset':'/signup',step=reset?(route.slice(base.length)||'/email'):route.slice(base.length);
    const title=reset?'비밀번호 재설정':'이메일로 가입';
    document.title=`${title} · 케어릿`;reassurance.hidden=true;
    if(step==='/email'){
      card.innerHTML=`${logo}<h1 id="login-title">${title}</h1><p class="auth-description">${reset?'가입한 이메일로 인증번호를 보내드려요.':'가입할 이메일로 인증번호를 보내드려요.'}</p><form id="auth-form" novalidate>${field('auth-email','이메일','email',draft.email,'autocomplete="email" required')}<p class="field-error" role="alert" hidden></p><button class="button primary login-button" type="submit">인증번호 받기</button></form><p class="field-help"><a href="#/">로그인 화면으로</a></p>`;
      const input=card.querySelector('#auth-email');
      card.querySelector('form').addEventListener('submit',event=>{event.preventDefault();if(!input.value.trim()||!input.validity.valid){showError(input.value.trim()?'올바른 이메일을 입력해 주세요.':'이메일을 입력해 주세요.',input);return;}draft.email=input.value.trim();go(`${base}/code`);});
      return;
    }
    if(step==='/code'){
      if(!draft.email){go(reset?base:`${base}/email`);return;}
      if(signup){
        card.innerHTML=`${logo}<h1 id="login-title">이메일로 가입</h1><p class="auth-description">메일로 코드를 보냈어요. 메일이 오지 않으면 스팸함을 확인하거나, 이미 가입된 주소인지 확인해 주세요.</p><form novalidate>${field('auth-code','확인 코드','text','','inputmode="numeric" autocomplete="one-time-code"')}<button class="button primary login-button" type="submit">코드 확인</button><button class="button auth-resend" id="resend-code" type="button" disabled>코드 다시 받기</button></form><p class="auth-countdown"><span id="resend-seconds">60</span>초 후 다시 받을 수 있어요.</p><p class="field-help"><a href="#/">로그인 화면으로</a></p><p class="login-message" role="status" hidden></p>`;
        const resend=card.querySelector('#resend-code'),countdown=card.querySelector('.auth-countdown');let seconds=60;
        resendTimer=setInterval(()=>{seconds--;if(seconds<=0){clearInterval(resendTimer);resend.disabled=false;countdown.hidden=true;}else card.querySelector('#resend-seconds').textContent=seconds;},1000);
        card.querySelector('form').addEventListener('submit',event=>{event.preventDefault();go(`${base}/details`);});
        resend.addEventListener('click',()=>{const message=card.querySelector('.login-message');message.textContent='목업에서는 이메일을 전송하지 않아요.';message.hidden=false;});
        return;
      }
      card.innerHTML=`${logo}<h1 id="login-title">인증번호 확인</h1><p class="auth-description"><strong>${escapeHTML(draft.email)}</strong>으로 보낸 인증번호를 입력해 주세요.</p><p class="auth-description auth-example">목업에서는 인증번호가 예시로 입력돼 있어요.</p><form novalidate>${field('auth-code','인증번호','text','123456','inputmode="numeric" autocomplete="one-time-code" maxlength="6"')}<button class="button primary login-button" type="submit">확인</button></form><div class="auth-links"><a href="#${reset?base:`${base}/email`}">이메일 수정</a><button type="button" class="auth-link" id="resend-code">인증번호 다시 받기</button></div><p class="login-message" role="status" hidden></p>`;
      card.querySelector('form').addEventListener('submit',event=>{event.preventDefault();go(reset?`${base}/new`:`${base}/details`);});
      card.querySelector('#resend-code').addEventListener('click',()=>{const message=card.querySelector('.login-message');message.textContent='목업에서는 이메일을 전송하지 않아요.';message.hidden=false;});
      return;
    }
    if((signup&&step==='/details')||(reset&&step==='/new')){
      const heading=reset?'새 비밀번호 설정':'회원 정보 입력';
      card.innerHTML=`${logo}<h1 id="login-title">${heading}</h1><form novalidate>${signup?field('auth-name','이름','text',draft.name,'autocomplete="name"'):''}${field('auth-password',reset?'새 비밀번호':'비밀번호','password','careit-demo-123','autocomplete="new-password"')}${field('auth-confirm','비밀번호 확인','password','careit-demo-123','autocomplete="new-password"')}<p class="field-error" role="alert" hidden></p><button class="button primary login-button" type="submit">${reset?'비밀번호 변경':'다음'}</button></form><p class="field-help"><a href="#${base}/code">이전으로</a></p>`;
      const form=card.querySelector('form'),password=card.querySelector('#auth-password'),confirm=card.querySelector('#auth-confirm'),name=card.querySelector('#auth-name');
      form.addEventListener('submit',event=>{event.preventDefault();if(name&&!name.value.trim()){showError('이름을 입력해 주세요.',name);return;}if(!password.value){showError('비밀번호를 입력해 주세요.',password);return;}if(password.value!==confirm.value){showError('비밀번호가 일치하지 않아요.',confirm);return;}if(name)draft.name=name.value.trim();go(reset?`${base}/complete`:`${base}/terms`);});
      return;
    }
    if(signup&&step==='/terms'){
      card.innerHTML=`${logo}<h1 id="login-title">약관 동의</h1><p class="auth-description">서비스 이용을 위해 내용을 확인해 주세요.</p><form novalidate><div class="auth-consents"><label class="login-remember"><input type="checkbox" required>이용약관 동의 (필수)</label><label class="login-remember"><input type="checkbox" required>개인정보 처리방침 확인 (필수)</label></div><p class="field-error" role="alert" hidden></p><button class="button primary login-button" type="submit">가입하기</button></form><div class="auth-links"><a href="#${base}/details">이전으로</a><span><a href="careit-mockup.html#/terms" target="_blank" rel="noopener">이용약관</a> · <a href="careit-mockup.html#/privacy" target="_blank" rel="noopener">개인정보 처리방침</a></span></div>`;
      card.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const unchecked=card.querySelector('input:not(:checked)');if(unchecked){showError('필수 항목을 확인해 주세요.',unchecked);return;}go(`${base}/complete`);});
      return;
    }
    if(step==='/complete'){
      const heading=reset?'비밀번호가 변경됐어요':'회원가입이 완료됐어요';
      card.innerHTML=`${logo}<h1 id="login-title">${heading}</h1><p class="auth-description">${reset?'새 비밀번호로 로그인해 주세요.':'케어릿에서 돌봄 기록을 시작해 보세요.'}</p><a class="button primary login-button auth-complete" href="#/">로그인하기</a>`;
      return;
    }
    go(reset?base:`${base}/email`);
  }
  window.addEventListener('hashchange',render);render();
})();

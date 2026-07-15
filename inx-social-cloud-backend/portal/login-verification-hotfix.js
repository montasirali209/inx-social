(function(){
  const params=new URLSearchParams(location.search);
  const email=localStorage.getItem('pendingEmail');
  const emailInput=document.querySelector('input[type="email"]');
  const message=document.querySelector('.message');
  if(email&&emailInput&&!emailInput.value)emailInput.value=email;
  if(params.get('verified')==='1'&&message){message.style.color='#147a61';message.textContent='Email verified. Your 5-day trial is active. Sign in below.'}
})();

document.getElementById('svc-form').addEventListener('submit',function(e){e.preventDefault();
var t='Hi Chatora, I\'d like a free 15-min audit.\nName: '+document.getElementById('f-name').value+'\nBusiness: '+document.getElementById('f-biz').value+'\nChannel: '+document.getElementById('f-ch').value+'\nGoal: '+document.getElementById('f-msg').value;
window.open('https://wa.me/201044772636?text='+encodeURIComponent(t),'_blank','noopener');});

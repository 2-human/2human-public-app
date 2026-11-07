/* M8 platform previews, shared by any view and by the proposal section. Each takes plain data and returns html.
 * Hub.previews.post, .feed (facebook, instagram, linkedin, nextdoor), .gbp, .review, .rsa, .email.
 * Platform colours stay on purpose: a preview reproduces the platform shown. Interface words are labels. */
(function () {
  var esc = Hub.esc, L = Hub.t;
  Hub.css('previews.css');
  Hub.labelDefaults({ pvBusiness: 'Business', pvDirections: 'Directions', pvSave: 'Save', pvWebsite: 'Website', pvCall: 'Call', pvShare: 'Share', pvGoogleReviews: 'Google reviews', pvLocalGuide: 'Local Guide', pvWriteReview: 'Write a review', pvReviews: 'Reviews', pvOwnerReply: 'Response from the owner', pvUpdates: 'Updates', pvViewAll: 'View all', pvProducts: 'Products and services', pvQa: 'Questions and answers', pvAllQuestions: 'See all questions', pvRatingDist: 'Rating distribution', pvRecent: 'Recent reviews', pvVerified: 'Verified company profile', pvExperience: 'Date of experience: ', pvReplyFrom: 'Reply from ', pvOwner: 'Owner', pvReviewsN: 'reviews', pvReview1: 'review', pvBasedOn: 'based on', pvTrustScore: 'TrustScore', pvOpen: 'Open',
    pvMapsTo: 'maps to article', pvLike: 'Like', pvComment: 'Comment', pvThank: 'Thank', pvReply: 'Reply', pvRepost: 'Repost', pvSend: 'Send', pvMore: 'more', pvSeeMore: 'See more', pvSponsored: 'Sponsored', pvHeadline: 'Headline {n}', pvDescription: 'Description {n}', pvNoneOption: '(none)', pvLength: '{h} of 90 headline characters, {d} of 180 description characters', pvFrom: 'From', pvSubject: 'Subject', pvPreheader: 'Preheader', pvLinksTo: 'Links to: {to}' });

  /* the proposal hub's social card. p: { platform:{ cls, tag, name }, img, title, location, cap, tags? } */
  function post(p) {
    var m = p.platform, tags = (p.tags || []).length ? '<div class="post__tags">' + p.tags.map(esc).join(' ') + '</div>' : '';
    return '<div class="post ' + esc(m.cls) + '"><div class="post__bar"><span class="post__pf" style="background:var(--' + esc(m.cls) + ', #8a8f98)">' + esc(m.tag) + '</span><b>' + esc(m.name) + '</b><small>' + esc(L('pvMapsTo')) + '</small></div>' +
      (p.img ? '<img class="post__img" src="' + esc(p.img) + '" alt="' + esc(p.title) + '">' : '') + '<div class="post__body"><div class="post__cap">' + esc(p.cap) + '</div>' + tags + '<div class="post__foot"><b>' + esc(p.title) + '</b> &middot; ' + esc(p.location) + '</div></div></div>';
  }
  /* a post as the platform's own feed shows it. p: { channel, account:{ name, handle?, meta?, mark? }, when, text, disclaimer?, img? }; mini clamps the text */
  function feed(p, mini) {
    var ac = p.account || {}, name = ac.name || '', mark = '<span class="pv-av">' + esc(ac.mark || name.charAt(0)) + '</span>', when = esc(p.when || '');
    var ch = { nextdoor: 'nd', facebook: 'fb', instagram: 'ig', linkedin: 'li' }[p.channel] || 'fb';
    var im = p.img ? '<img class="pv-img" src="' + esc(p.img) + '" alt="" loading="lazy">' : '';
    var tx = function (pre) { return '<div class="pv-tx' + (mini ? ' clamp' : '') + '">' + (pre || '') + esc(p.text) + (p.disclaimer ? '\n\n' + esc(p.disclaimer) : '') + '</div>' + (mini ? '<div class="pv-more">' + esc(L(ch === 'ig' ? 'pvMore' : 'pvSeeMore')) + '</div>' : ''); };
    var ft = function (list) { return '<div class="pv-ft">' + list.map(function (k) { return '<span>' + esc(L(k)) + '</span>'; }).join('') + '</div>'; };
    var hd = '<div class="pv-hd">' + mark + '<span><b>' + esc(ch === 'ig' ? ac.handle || name : name) + '</b>' + (ac.meta && ch === 'li' ? '<small>' + esc(ac.meta) + '</small>' : '') + (ch === 'ig' ? '' : '<small>' + when + '</small>') + '</span></div>';
    var box = '<div class="pv pv-' + ch + (mini ? ' mini' : '') + '">' + hd;
    if (ch === 'ig') return box + im + tx('<b>' + esc(ac.handle || name) + '</b> ') + '<div class="pv-more">' + when + '</div></div>';
    return box + tx() + im + ft(ch === 'nd' ? ['pvThank', 'pvReply', 'pvShare'] : ch === 'li' ? ['pvLike', 'pvComment', 'pvRepost', 'pvSend'] : ['pvLike', 'pvComment', 'pvShare']) + '</div>';
  }
  function starStr(n){ n=Math.max(0,Math.min(5,Math.round(n==null?5:n))); return '★★★★★☆☆☆☆☆'.slice(5-n,10-n); }
  // Rating-distribution bars from a config `dist:[{s,p}]` array (5→1). Shared shape
  // between D and Trustpilot; both supply their own data, none is hardcoded.
  function distBars(dist,cls){ return (dist||[]).map(function(d){
    return '<div class="'+cls+'"><span class="lab">'+d.s+(cls==='g-bar'?'':'-star')+'</span><span class="track"><span class="fill" style="width:'+d.p+'%"></span></span>'+(cls==='g-bar'?'':'<span class="pct">'+d.p+'%</span>')+'</div>'; }).join(''); }

  function gbp(D,fallback){
    D=D||{};
    var gname = D.name || fallback || L('pvBusiness');
    // Images are paths in the data (like social[].img); the chassis owns no asset root.
    var strip=(D.photos||[]).map(function(src){return '<img src="'+esc(src)+'" alt="'+esc(gname)+'">';}).join('');
    var acts=[["🧭",L('pvDirections')],["🔖",L('pvSave')],["🌐",L('pvWebsite')],["📞",L('pvCall')],["↗",L('pvShare')]].map(function(a){return '<div class="g-act"><span class="ic2">'+a[0]+'</span>'+a[1]+'</div>';}).join('');
    function grow(ic,inner){ return inner?('<div class="row"><span class="gi">'+ic+'</span>'+inner+'</div>'):''; }
    var head='<div class="gcard gbp-head"><div class="gbp-head__main">'
      +'<h3>'+esc(gname)+'</h3>'
      +'<div class="g-rating"><b>'+esc(D.rating)+'</b><span class="g-stars">'+starStr(D.rating)+'</span><a>'+esc(D.reviewCount)+' '+L('pvGoogleReviews')+'</a></div>'
      +(D.category?'<div class="g-cat">'+esc(D.category)+'</div>':'')
      +'<div class="g-actions">'+acts+'</div>'
      +'<div class="g-info">'
        +grow('📍', D.address?esc(D.address):'')
        +grow('🕒', D.hours?('<span><span class="open">'+L('pvOpen')+'</span> &middot; '+esc(D.hours)+'</span>'):'')
        +grow('📞', D.phone?'<a>'+esc(D.phone)+'</a>':'')
        +grow('🌐', D.website?'<a>'+esc(D.website)+'</a>':'')
        +grow('✓', D.attrs?esc(D.attrs):'')
      +'</div></div><div class="gbp-head__photos">'+strip+'</div></div>';
    var pal=["#c5221f","#1a73e8","#188038","#e37400","#7c3aed","#0b8043"];
    var revs=(D.reviews||[]).map(function(r,i){
      return '<div class="g-rev"><div class="g-rev__top"><div class="g-av" style="background:'+pal[i%pal.length]+'">'+esc(r.author[0])+'</div>'
        +'<div class="g-rev__who"><b>'+esc(r.author)+'</b><span>'+L('pvLocalGuide')+' &middot; '+esc(r.when)+'</span></div></div>'
        +'<div class="g-rev__stars">'+starStr(r.rating)+'</div><div class="g-rev__text">'+esc(r.text)+'</div>'
        +(r.ownerReply?'<div class="g-reply"><b>'+L('pvOwnerReply')+'</b><span>'+esc(r.when)+'</span><p>'+esc(r.ownerReply)+'</p></div>':'')+'</div>';
    }).join('');
    var revsec='<div class="g-sec"><div class="g-sec__h"><h4>'+L('pvReviews')+'</h4><span class="more">'+L('pvWriteReview')+'</span></div>'
      +'<div class="g-revsum"><div class="big">'+esc(D.rating)+'<span class="s">'+starStr(D.rating)+'</span><span class="c">'+esc(D.reviewCount)+' '+L('pvReviewsN')+'</span></div>'
      +'<div class="bars">'+distBars(D.dist,'g-bar')+'</div></div>'
      +revs+'</div>';
    var posts=(D.posts||[]).map(function(p){
      return '<div class="g-post">'+(p.img?'<img src="'+esc(p.img)+'" alt="">':'')
        +'<div class="g-post__b"><span class="g-post__type">'+esc(p.type)+'</span><b>'+esc(p.title)+'</b><p>'+esc(p.body)+'</p><span class="g-post__cta">'+esc(p.cta)+' &rarr;</span></div></div>';
    }).join('');
    var postsec='<div class="g-sec"><div class="g-sec__h"><h4>'+L('pvUpdates')+'</h4><span class="more">'+L('pvViewAll')+'</span></div><div class="g-posts">'+posts+'</div></div>';
    var prods=(D.products||[]).map(function(p){
      return '<div class="g-prod">'+(p.img?'<img src="'+esc(p.img)+'" alt="">':'')+'<div class="g-prod__b"><b>'+esc(p.name)+'</b><div class="price">'+esc(p.price)+'</div><p>'+esc(p.desc)+'</p></div></div>';
    }).join('');
    var prodsec='<div class="g-sec"><div class="g-sec__h"><h4>'+L('pvProducts')+'</h4><span class="more">'+L('pvViewAll')+'</span></div><div class="g-prods">'+prods+'</div></div>';
    var qas=(D.qa||[]).map(function(q){
      return '<div class="g-qa"><div class="g-qa__q"><span class="qm">Q</span>'+esc(q.q)+'</div><div class="g-qa__a"><span class="badge-o">'+L('pvOwner')+'</span><span>'+esc(q.a)+'</span></div></div>';
    }).join('');
    var qasec='<div class="g-sec"><div class="g-sec__h"><h4>'+L('pvQa')+'</h4><span class="more">'+L('pvAllQuestions')+'</span></div>'+qas+'</div>';
    return head+revsec+postsec+prodsec+qasec;
  }

  function tpStars(n, sm){ n=Math.round(n||0); var s=''; for(var i=1;i<=5;i++){ s+='<span class="tpsq'+(sm?' sm':'')+(i>n?' off':'')+'">&#9733;</span>'; } return '<span class="tp-stars">'+s+'</span>'; }
  function review(D,fallback){
    D=D||{};
    var pal=["#1a73e8","#c5221f","#188038","#e37400","#7c3aed"];
    var tname = D.name || fallback || L('pvBusiness');
    var head='<div class="tp-head"><h3>'+esc(tname)+'</h3>'
      +(D.domain?'<a class="tp-domain" href="https://www.trustpilot.com/review/'+esc(D.domain)+'" target="_blank" rel="noopener">'+esc(D.domain)+'</a>':'')
      +'<div class="tp-score">'+tpStars(D.score)+'<span class="tp-trustscore">'+L('pvTrustScore')+' <b>'+esc(D.score)+'</b></span></div>'
      +'<div class="tp-meta"><b>'+esc(D.label)+'</b> &middot; '+L('pvBasedOn')+' <b>'+esc(D.reviewCount)+'</b> '+L('pvReviewsN')+'</div>'
      +'<div class="tp-verified">&#10003; '+L('pvVerified')+'</div></div>';
    var distsec='<div class="tp-sec"><div class="tp-sec__h">'+L('pvRatingDist')+'</div><div class="tp-dist">'+distBars(D.dist,'tp-drow')+'</div></div>';
    var revs=(D.reviews||[]).map(function(r,i){
      return '<div class="tp-rev"><div class="tp-rev__top"><div class="tp-av" style="background:'+pal[i%pal.length]+'">'+esc(r.author[0])+'</div>'
        +'<div class="tp-rev__who"><b>'+esc(r.author)+'</b><span>'+esc(String(r.nrev))+(r.nrev===1?' '+L('pvReview1'):' '+L('pvReviewsN'))+' &middot; '+esc(r.loc)+'</span></div>'
        +'<span class="tp-rev__meta">'+esc(r.when)+'</span></div>'
        +tpStars(r.rating,true)
        +'<b class="tp-rev__title">'+esc(r.title)+'</b>'
        +'<p class="tp-rev__body">'+esc(r.body)+'</p>'
        +'<span class="tp-doe">'+L('pvExperience')+''+esc(r.doe)+'</span>'
        +(r.reply?'<div class="tp-reply"><b>'+L('pvReplyFrom')+''+esc(tname)+'</b><span>'+esc(r.when)+'</span><p>'+esc(r.reply)+'</p></div>':'')
        +'</div>';
    }).join('');
    var revsec='<div class="tp-sec"><div class="tp-sec__h">'+L('pvRecent')+'</div>'+revs+'</div>';
    return head+distsec+revsec;
  }

  // ---------- Who we are: client wall ----------
  /* a responsive search ad: pick headlines and descriptions, see the result. a: { id, headlines, descriptions, host, path?, callouts? } */
  var ADS = {};
  function rsa(a) {
    ADS[a.id] = a;
    var sel = function (key, label, list, pick, blank) { return '<label>' + esc(label) + '<select data-rsa-k="' + key + '">' + (blank ? '<option value="-1">' + esc(L('pvNoneOption')) + '</option>' : '') + list.map(function (x, i) { return '<option value="' + i + '"' + (i === pick ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>'; };
    var H = a.headlines, D = a.descriptions;
    return '<div data-rsa="' + esc(a.id) + '"><div class="rsa-pick">' + sel('h1', L('pvHeadline', { n: 1 }), H, 0) + sel('h2', L('pvHeadline', { n: 2 }), H, Math.min(1, H.length - 1)) + sel('h3', L('pvHeadline', { n: 3 }), H, -1, true) + sel('d1', L('pvDescription', { n: 1 }), D, 0) + sel('d2', L('pvDescription', { n: 2 }), D, -1, true) + '</div><div class="serp-out">' + serp(a, 0, Math.min(1, H.length - 1), -1, 0, -1) + '</div></div>';
  }
  function serp(a, h1, h2, h3, d1, d2) {
    var hs = [h1, h2, h3].filter(function (i) { return i >= 0; }).map(function (i) { return a.headlines[i]; }), ds = [d1, d2].filter(function (i) { return i >= 0; }).map(function (i) { return a.descriptions[i]; });
    return '<div class="serp"><div class="sp">' + esc(L('pvSponsored')) + '</div><div class="url">' + esc(a.host) + (a.path ? '/' + esc(a.path) : '') + '</div><span class="hl">' + esc(hs.join(' | ')) + '</span><div class="ds">' + esc(ds.join(' ')) + '</div>' + ((a.callouts || []).length ? '<div class="cl">' + a.callouts.map(esc).join(' · ') + '</div>' : '') + '</div><p class="cnt">' + esc(L('pvLength', { h: hs.join('').length, d: ds.join('').length })) + '</p>';
  }
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('[data-rsa-k]')) return;
    var box = e.target.closest('[data-rsa]'), a = ADS[box.getAttribute('data-rsa')], v = function (k) { return +box.querySelector('[data-rsa-k="' + k + '"]').value; };
    box.querySelector('.serp-out').innerHTML = serp(a, v('h1'), v('h2'), v('h3'), v('d1'), v('d2'));
  });
  /* an email as sent. e: { from, subject, preheader, bodyHtml, button?, buttonTarget?, logo?, footer? }; {{tokens}} are marked */
  function email(e) {
    var body = String(e.bodyHtml).replace(/\{\{(\w+)\}\}/g, '<span class="tok">{{$1}}</span>');
    return '<div class="mail"><div class="mh"><div><span class="k">' + esc(L('pvFrom')) + '</span>' + esc(e.from) + '</div><div><span class="k">' + esc(L('pvSubject')) + '</span><b>' + esc(e.subject) + '</b></div><div><span class="k">' + esc(L('pvPreheader')) + '</span>' + esc(e.preheader) + '</div></div><div class="mb">' + (e.logo ? '<div class="logo">' + esc(e.logo) + '</div>' : '') + body +
      (e.button ? '<div><span class="cta">' + esc(e.button) + '</span></div>' + (e.buttonTarget ? '<div class="cta-t">' + esc(L('pvLinksTo', { to: e.buttonTarget })) + '</div>' : '') : '') + '</div>' + (e.footer ? '<div class="mf">' + esc(e.footer) + '</div>' : '') + '</div>';
  }
  Hub.previews = { post: post, feed: feed, gbp: gbp, review: review, rsa: rsa, email: email };
})();

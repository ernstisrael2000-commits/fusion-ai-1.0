(function () {
  let screen = (location.hash || '').slice(1);
  const allowedScreens = new Set(['home', 'studio', 'gallery', 'settings', 'inspiration', 'save']);
  if (!allowedScreens.has(screen)) screen = 'home';

  let activeFilter = 'all';
  let searchTerm = '';
  let portalRows = [];
  let renderToken = 0;
  const originalRender = render;

  const icon = name => {
    const paths = {
      sparkles: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
      folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/><path d="M3 9h18"/>',
      film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      people: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6"/>',
      camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
      play: '<path d="m8 5 11 7-11 7V5Z"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      x: '<path d="m6 6 12 12M18 6 6 18"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-6 0 3 3"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkles}</svg>`;
  };

  function hasProjectData(project) {
    return !!(project && (
      (project.title || '').trim() ||
      (project.final || '').trim() ||
      (project.synRaw || '').trim() ||
      project.genre ||
      (project.chars || []).length ||
      (project.scenes || []).length
    ));
  }

  function projectTitle(project) {
    return (project && (project.title || (project.genre && project.genre.name))) ||
      (project && project.final && project.final.trim().slice(0, 54)) ||
      'Projet sans titre';
  }

  function projectObjects(project) {
    const characters = project.chars || [];
    const scenes = project.scenes || [];
    return [
      ...characters,
      ...scenes,
      ...scenes.flatMap(scene => scene.shots || [])
    ];
  }

  function imageSource(image) {
    if (!image) return '';
    if (typeof image === 'string') return image;
    return image.d || image.u || '';
  }

  function coverSource(project) {
    const objects = projectObjects(project);
    const firstImage = objects.find(item => item && item.img);
    return imageSource((project.imageLab && project.imageLab.image) || (firstImage && firstImage.img));
  }

  function generatedImageCount(project) {
    return projectObjects(project).filter(item => item && item.img).length;
  }

  function projectDate(project) {
    const time = Number(project.upd || project.created || Date.now());
    const delta = Math.max(0, Date.now() - time);
    if (delta < 60_000) return 'À l’instant';
    if (delta < 3_600_000) return `Il y a ${Math.floor(delta / 60_000)} min`;
    if (delta < 86_400_000) return `Il y a ${Math.floor(delta / 3_600_000)} h`;
    if (delta < 604_800_000) return `Il y a ${Math.floor(delta / 86_400_000)} j`;
    return new Date(time).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'});
  }

  async function getProjects() {
    const saved = await dbAll('sessions');
    const rows = Array.isArray(saved) ? saved.filter(hasProjectData) : [];
    if (P && hasProjectData(P)) {
      const currentIndex = rows.findIndex(item => item.id === P.id);
      if (currentIndex >= 0) rows[currentIndex] = P;
      else rows.push(P);
    }
    return rows.sort((a, b) => Number(b.upd || b.created || 0) - Number(a.upd || a.created || 0));
  }

  function projectCard(project) {
    const src = coverSource(project);
    const scenes = (project.scenes || []).length;
    const images = generatedImageCount(project);
    const kind = project.format || (project.projectMode === 'continue' ? 'Épisode' : 'Film');
    const synopsis = project.final || project.synRaw || (project.genre && project.genre.name) || 'Synopsis à compléter';
    return `<article class="portal-project-card">
      <div class="portal-project-cover">
        ${src ? `<img src="${esc(src)}" alt="Aperçu de ${esc(projectTitle(project))}" loading="lazy">` : `<span class="portal-cover-placeholder">${icon('image')}</span>`}
        <span class="portal-project-kind">${esc(kind)}</span>
      </div>
      <div class="portal-project-body">
        <h3>${esc(projectTitle(project))}</h3>
        <p>${esc(synopsis)}</p>
        <div class="portal-project-meta"><span>${esc(projectDate(project))}</span><span>${scenes} scène${scenes === 1 ? '' : 's'} · ${images} image${images === 1 ? '' : 's'}</span></div>
        <div class="portal-project-actions">
          <button type="button" data-a="portal-open" data-id="${esc(project.id)}">Ouvrir ${icon('arrow')}</button>
          <button type="button" data-a="portal-delete" data-id="${esc(project.id)}" aria-label="Supprimer ${esc(projectTitle(project))}" title="Supprimer ce projet">${icon('trash')}</button>
        </div>
      </div>
    </article>`;
  }

  function emptyState(title, description, buttonLabel, action) {
    return `<div class="portal-empty"><div><div>${icon('film')}</div><h3>${esc(title)}</h3><p>${esc(description)}</p><button class="portal-primary-button" type="button" data-a="${action}">${esc(buttonLabel)} ${icon('arrow')}</button></div></div>`;
  }

  function renderHome() {
    const rows = portalRows;
    const scenes = rows.reduce((total, project) => total + (project.scenes || []).length, 0);
    const imageTotal = rows.reduce((total, project) => total + generatedImageCount(project), 0);
    const credentials = (KEYS && KEYS.list || []).filter(item => item && !item.off).length;
    const recent = rows.slice(0, 3);
    return `<div class="portal-screen portal-dashboard">
      <section class="portal-hero">
        <span class="portal-eyebrow">${icon('sparkles')} FUSION AI · STUDIO CRÉATIF</span>
        <h1>Donnez vie à votre <span class="portal-gradient-text">prochaine histoire.</span></h1>
        <p>Écrivez, imaginez et préparez votre film étape par étape. Vos projets et vos images restent dans ce navigateur.</p>
        <div class="portal-hero-actions">
          <button type="button" class="portal-primary-button" data-a="portal-create">${icon('sparkles')} Commencer une création</button>
          <button type="button" class="portal-secondary-button" data-a="portal-route" data-screen="gallery">Mes projets ${icon('arrow')}</button>
        </div>
      </section>
      <section class="portal-section">
        <div class="portal-section-heading"><h2>Votre espace de création</h2><button type="button" class="portal-link-button" data-a="portal-route" data-screen="settings">${credentials ? `${credentials} clé${credentials === 1 ? '' : 's'} IA configurée${credentials === 1 ? '' : 's'}` : 'Configurer les IA'}</button></div>
        <div class="portal-stat-grid">
          <div class="portal-stat">${icon('folder')}<strong>${rows.length}</strong><span>Projets enregistrés</span></div>
          <div class="portal-stat">${icon('film')}<strong>${scenes}</strong><span>Scènes préparées</span></div>
          <div class="portal-stat">${icon('image')}<strong>${imageTotal}</strong><span>Images créées</span></div>
        </div>
      </section>
      <section class="portal-section">
        <div class="portal-section-heading"><h2>Outils du studio</h2><span class="portal-count">Raccourcis vers vos vrais outils</span></div>
        <div class="portal-tool-grid">
          <button type="button" class="portal-settings-card portal-tool-card" data-a="portal-open-tool" data-step="1"><span class="portal-tool-icon">${icon('sparkles')}</span><h3>Studio créatif</h3><p>Genre, synopsis et création du film.</p></button>
          <button type="button" class="portal-settings-card portal-tool-card" data-a="portal-open-tool" data-step="3"><span class="portal-tool-icon">${icon('people')}</span><h3>Personnages</h3><p>Fiches, portraits et références visuelles.</p></button>
          <button type="button" class="portal-settings-card portal-tool-card" data-a="portal-open-tool" data-step="6"><span class="portal-tool-icon">${icon('camera')}</span><h3>Atelier d’images</h3><p>Prompts, images, reprises et exports.</p></button>
        </div>
      </section>
      <section class="portal-section">
        <div class="portal-section-heading"><h2>Projets récents</h2><button type="button" class="portal-link-button" data-a="portal-route" data-screen="gallery">Voir toute la galerie ${icon('arrow')}</button></div>
        ${recent.length ? `<div class="portal-project-grid">${recent.map(projectCard).join('')}</div>` : emptyState('Votre galerie est prête', 'Commencez un film ou un épisode. Vous pourrez reprendre votre travail ici plus tard.', 'Créer un premier projet', 'portal-create')}
      </section>
    </div>`;
  }

  function matchingProjects() {
    const query = searchTerm.trim().toLocaleLowerCase('fr');
    return portalRows.filter(project => {
      if (activeFilter === 'scenes' && !(project.scenes || []).length) return false;
      if (activeFilter === 'characters' && !(project.chars || []).length) return false;
      if (activeFilter === 'images' && !generatedImageCount(project)) return false;
      if (!query) return true;
      const text = [projectTitle(project), project.final, project.synRaw, project.genre && project.genre.name]
        .filter(Boolean).join(' ').toLocaleLowerCase('fr');
      return text.includes(query);
    });
  }

  function updateGalleryCards() {
    const cards = document.getElementById('portal-cards');
    const count = document.getElementById('portal-count');
    if (!cards || !count) return;
    const matching = matchingProjects();
    count.textContent = `${matching.length} projet${matching.length === 1 ? '' : 's'}`;
    cards.innerHTML = matching.length
      ? matching.map(projectCard).join('')
      : emptyState('Aucun projet trouvé', searchTerm ? 'Essayez un autre titre ou effacez la recherche.' : 'Cette catégorie ne contient pas encore de projet.', 'Créer un projet', 'portal-create');
  }

  function renderGallery() {
    const options = [['all', 'Tout'], ['scenes', 'Scènes'], ['characters', 'Personnages'], ['images', 'Images']];
    return `<div class="portal-screen">
      <div class="portal-section-heading"><div><span class="portal-eyebrow">${icon('folder')} VOTRE BIBLIOTHÈQUE</span><h1 class="portal-page-title" style="margin-top:14px">Mes projets</h1><p class="portal-page-subtitle">Retrouvez et reprenez les films enregistrés sur cet appareil.</p></div><button type="button" class="portal-primary-button" data-a="portal-create">${icon('plus')} Nouveau projet</button></div>
      <div class="portal-filter-row">${options.map(([value, label]) => `<button type="button" class="portal-filter-button ${activeFilter === value ? 'is-active' : ''}" data-a="portal-filter" data-filter="${value}">${label}</button>`).join('')}</div>
      <div class="portal-gallery-toolbar"><input id="portal-search-input" class="portal-search" type="search" value="${esc(searchTerm)}" placeholder="Rechercher un titre ou un synopsis…" aria-label="Rechercher dans les projets"><span class="portal-count" id="portal-count"></span></div>
      <div class="portal-project-grid" id="portal-cards"></div>
    </div>`;
  }

  function renderSettings() {
    const cfg = window.CGCFG || {};
    const keyCount = (KEYS.list || []).filter(item => item && !item.off).length;
    return `<div class="portal-screen">
      <span class="portal-eyebrow">${icon('key')} PARAMÈTRES DU STUDIO</span>
      <h1 class="portal-page-title" style="margin-top:14px">Réglages des outils</h1>
      <p class="portal-page-subtitle">Configurez les fournisseurs utilisés par les étapes de création. Les clés sont conservées localement dans ce navigateur.</p>
      <div class="portal-settings-grid">
        <section class="portal-settings-card">
          <h2>Images et vidéos · Agnès</h2>
          <p>${keyCount} clé${keyCount === 1 ? '' : 's'} active${keyCount === 1 ? '' : 's'} sur cet appareil.</p>
          <label class="portal-field lab" for="portal-agnes-keys">Clés Agnès, une par ligne
            <textarea id="portal-agnes-keys" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Collez une ou plusieurs clés Agnès">${esc((KEYS.list || []).map(item => item.k).join('\n'))}</textarea>
          </label>
          <label class="portal-field lab" for="portal-agnes-plan">Type de clés
            <select id="portal-agnes-plan"><option value="free" ${KEYS.plan === 'free' ? 'selected' : ''}>Gratuites</option><option value="plan" ${KEYS.plan === 'plan' ? 'selected' : ''}>Payantes · Token Plan</option></select>
          </label>
          <div class="portal-settings-note">Agnès est nécessaire pour générer les images. La génération automatique de vidéos est désactivée dans cette version : les prompts de plans sont exportés pour être utilisés manuellement.</div>
        </section>
        <section class="portal-settings-card">
          <h2>Texte · Groq (facultatif)</h2>
          <p>Agnès peut aussi écrire le scénario. Groq est un fournisseur alternatif pour le texte.</p>
          <label class="portal-field lab" for="portal-groq-keys">Clés Groq, une par ligne
            <textarea id="portal-groq-keys" rows="3" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Collez vos clés Groq">${esc((cfg.groqKeys || []).join('\n'))}</textarea>
          </label>
          <label class="portal-field lab" for="portal-groq-model">Modèle Groq
            <input id="portal-groq-model" type="text" value="${esc(cfg.groqModel || 'openai/gpt-oss-20b')}" placeholder="Identifiant exact du modèle">
          </label>
          <label class="portal-field lab" for="portal-text-provider">Fournisseur principal du scénario
            <select id="portal-text-provider"><option value="agnes" ${cfg.textProvider !== 'groq' ? 'selected' : ''}>Agnès</option><option value="groq" ${cfg.textProvider === 'groq' ? 'selected' : ''}>Groq</option></select>
          </label>
          <label class="portal-check"><input id="portal-fallback" type="checkbox" ${cfg.fallbackEnabled ? 'checked' : ''}> <span>Utiliser Agnès si le fournisseur principal ne répond pas.</span></label>
        </section>
        <section class="portal-settings-card">
          <h2>Préférences du projet ouvert</h2>
          <p>Ces choix sont enregistrés avec le film actuellement ouvert.</p>
          <label class="portal-field lab" for="portal-dialogue-lang">Langue des dialogues
            <select id="portal-dialogue-lang" data-portal-project-field="dialogueLang"><option value="fr" ${(P.dialogueLang || 'fr') === 'fr' ? 'selected' : ''}>Français</option><option value="ht" ${P.dialogueLang === 'ht' ? 'selected' : ''}>Créole haïtien · Kreyòl</option></select>
          </label>
          <label class="portal-field lab" for="portal-voice-mode">Gestion des voix
            <select id="portal-voice-mode" data-portal-project-field="voiceMode"><option value="capcut" ${(P.voiceMode || 'capcut') === 'capcut' ? 'selected' : ''}>Préparer les dialogues pour un montage externe</option><option value="integrated" ${P.voiceMode === 'integrated' ? 'selected' : ''}>Voix intégrées si le modèle le permet</option><option value="silent" ${P.voiceMode === 'silent' ? 'selected' : ''}>Vidéo silencieuse</option></select>
          </label>
        </section>
        <section class="portal-settings-card">
          <h2>Stockage et journal</h2>
          <p>Les projets et les images réduites sont stockés dans le navigateur actuel, pas sur un compte cloud.</p>
          <div class="portal-settings-note">Les clés ne sont pas envoyées à Replit. Lors d’une génération, la clé du fournisseur choisi est transmise à son API. Ne partagez pas une capture d’écran ou un export qui contiendrait vos données privées.</div>
          <div class="portal-settings-actions"><button class="portal-secondary-button" type="button" data-a="portal-open-log">Ouvrir le journal technique</button></div>
        </section>
      </div>
      <div class="portal-settings-actions"><button class="portal-secondary-button" type="button" data-a="portal-route" data-screen="home">Annuler</button><button class="portal-primary-button" type="button" data-a="portal-settings-save">${icon('check')} Enregistrer les réglages</button></div>
    </div>`;
  }

  function renderSavePage() {
    const src = coverSource(P);
    const projectType = P.format || (P.projectMode === 'continue' ? 'Feuilleton' : 'Film');
    const labels = [...new Set([P.genre && P.genre.name, projectType, ...(P.tags || [])].filter(Boolean))];
    return `<div class="portal-screen portal-save-page">
      <div class="portal-save-top"><button type="button" class="portal-secondary-button" data-a="portal-route" data-screen="studio" aria-label="Retour au studio">${icon('arrow')} Retour</button><h1>Enregistrer le projet</h1><button type="button" class="fusion-icon-button" data-a="portal-route" data-screen="home" aria-label="Fermer">${icon('x')}</button></div>
      <div class="portal-save-cover">
        ${src ? `<img src="${esc(src)}" alt="Aperçu du projet">` : `<span class="portal-cover-placeholder">${icon('image')}</span>`}
        <div class="portal-save-cover-labels"><span>${esc(P.ratio || '16:9')}</span><span>${esc(projectType)}</span></div>
      </div>
      <div class="portal-save-form">
        <label>Nom du projet<input type="text" data-f="title" data-id="P" value="${esc(P.title || '')}" placeholder="Donnez un nom à votre projet"></label>
        <label>Synopsis ou description<textarea data-f="final" data-id="P" rows="4" placeholder="Résumez l’idée du film…">${esc(P.final || P.synRaw || '')}</textarea></label>
        <label>Genre et tags<input id="portal-tags" type="text" value="${esc((P.tags || []).join(', '))}" placeholder="Ajoutez des mots-clés séparés par des virgules"></label>
        <div class="portal-settings-note"><span class="portal-inline-icon">${icon('lock')}</span> Projet privé : il est enregistré uniquement dans la galerie de ce navigateur. Aucun partage public ou espace communautaire n’est configuré dans cette version.</div>
      </div>
      <div class="portal-save-bottom">
        <button type="button" class="portal-primary-button" data-a="portal-save-project">${icon('check')} Enregistrer dans ma galerie</button>
        <button type="button" class="portal-secondary-button" data-a="portal-save-share">Enregistrer et partager le fichier ${icon('arrow')}</button>
        ${labels.length ? `<div class="portal-filter-row">${labels.map(label => `<span class="portal-filter-button is-active">${esc(label)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  function renderInspiration() {
    const genres = G.flatMap(([group, entries]) => entries.map(entry => {
      const parts = entry.split('|');
      return {group, name: parts[0], style: parts[1] || 'cinematic visual storytelling'};
    }));
    return `<div class="portal-screen">
      <span class="portal-eyebrow">${icon('sparkles')} CARNET D’INSPIRATION</span>
      <h1 class="portal-page-title" style="margin-top:14px">Explorez un univers</h1>
      <p class="portal-page-subtitle">Choisissez un genre du catalogue de création. Il sera prérempli dans un nouveau projet ; vous pourrez le modifier avant de commencer.</p>
      ${G.map(([group]) => `<section class="portal-section" style="margin-top:26px"><div class="portal-section-heading"><h2>${esc(group)}</h2></div><div class="portal-genre-grid">${genres.filter(item => item.group === group).map(item => `<button type="button" class="portal-settings-card portal-genre-card" data-a="portal-inspire" data-genre="${esc(item.name)}" data-style="${esc(item.style)}">${icon('sparkles')}<strong>${esc(item.name)}</strong><span>Créer un projet dans cet univers</span></button>`).join('')}</div></section>`).join('')}
    </div>`;
  }

  function renderStage() {
    const stage = document.getElementById('fusion-stage');
    if (!stage || screen !== 'studio' || !P) return;
    const src = coverSource(P);
    const currentStep = Math.min(7, Math.max(1, Number(page || 0) + 1));
    const imageCount = generatedImageCount(P);
    const ratio = ({'16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1', '4:3': '4 / 3', '3:4': '3 / 4'})[P.ratio] || '16 / 9';
    const playable = projectObjects(P).some(item => item && (item.img || item.video));
    stage.innerHTML = `<section class="fusion-stage-card">
      <div class="fusion-stage-image" style="aspect-ratio:${ratio}">
        ${src ? `<img src="${esc(src)}" alt="Aperçu du projet ${esc(projectTitle(P))}">` : `<div class="fusion-stage-empty">${icon('image')}<div>Votre aperçu apparaîtra ici après l’import ou la création d’une première image.</div></div>`}
      </div>
      <div class="fusion-stage-info">
        <span class="portal-eyebrow">${icon('sparkles')} ÉTAPE ${currentStep} / 7</span>
        <h1>${esc(projectTitle(P))}</h1>
        <p>${esc((P.genre && P.genre.name) || 'Nouveau projet')} · ${imageCount} image${imageCount === 1 ? '' : 's'} prête${imageCount === 1 ? '' : 's'}</p>
        <div class="fusion-stage-actions">
          <button class="portal-secondary-button" type="button" data-a="play" ${playable ? '' : 'disabled'}>${icon('play')} Aperçu</button>
          <button class="portal-primary-button" type="button" data-a="portal-route" data-screen="save">Enregistrer ${icon('arrow')}</button>
        </div>
      </div>
    </section>`;
  }

  async function drawPortal() {
    const main = document.getElementById('main');
    if (!main || screen === 'studio') return;
    const ticket = ++renderToken;
    const requested = screen;
    let error = '';
    if (requested === 'home' || requested === 'gallery') {
      try {
        portalRows = await getProjects();
      } catch (e) {
        error = e && e.message ? e.message : 'Stockage indisponible';
        log('er', 'Galerie : ' + error);
      }
    }
    if (ticket !== renderToken || screen !== requested) return;

    if (requested === 'home') {
      main.innerHTML = error
        ? `<div class="portal-empty"><div><h3>Impossible de charger les projets</h3><p>${esc(error)}</p><button type="button" class="portal-secondary-button" data-a="portal-route" data-screen="settings">Vérifier les réglages</button></div></div>`
        : renderHome();
    } else if (requested === 'gallery') {
      main.innerHTML = error ? `<div class="portal-empty"><div><h3>Galerie indisponible</h3><p>${esc(error)}</p></div></div>` : renderGallery();
      updateGalleryCards();
    } else if (requested === 'settings') {
      main.innerHTML = renderSettings();
    } else if (requested === 'inspiration') {
      main.innerHTML = renderInspiration();
    } else if (requested === 'save') {
      main.innerHTML = renderSavePage();
    }
    updateNav();
  }

  function updateNav() {
    document.querySelectorAll('#fusion-bottom-nav [data-screen]').forEach(button => {
      const target = button.dataset.screen;
      const active = (screen === 'home' && target === 'home') ||
        (screen === 'gallery' && target === 'gallery') ||
        (screen === 'inspiration' && target === 'inspiration') ||
        (screen === 'settings' && target === 'settings');
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const steps = document.getElementById('steps');
    if (steps) steps.hidden = screen !== 'studio';
    const stage = document.getElementById('fusion-stage');
    if (stage) stage.hidden = screen !== 'studio';
    const main = document.getElementById('main');
    if (main) main.dataset.screen = screen;
    document.body.dataset.screen = screen;
    if (screen === 'studio') renderStage();
  }

  function setScreen(next, replace) {
    if (!allowedScreens.has(next)) return;
    screen = next;
    const expected = `#${next}`;
    if (location.hash !== expected) {
      const method = replace ? 'replaceState' : 'pushState';
      history[method](null, '', expected);
    }
    updateNav();
    render();
  }

  function wrappedRender(keep) {
    originalRender(keep);
    updateNav();
    if (screen !== 'studio') drawPortal();
  }
  render = wrappedRender;

  function openStudio(step) {
    if (KEYS.list.length === 0) {
      page = 0;
    } else if (Number.isInteger(step)) {
      page = Math.max(1, Math.min(6, step));
      if ((step === 3 || step === 4 || step === 5 || step === 6) && !P.genre) page = 1;
    } else {
      page = Math.max(1, Math.min(6, Number(P.page || P.last || 1)));
    }
    setScreen('studio');
  }

  async function saveCurrentProject() {
    if (!P) return;
    clearTimeout(svT);
    P.upd = Date.now();
    await dbPut('sessions', P);
  }

  async function startNewProject(genre) {
    if (TASK) return toast('Une génération est en cours. Attendez ou arrêtez-la avant de créer un autre projet.');
    try {
      if (P && hasProjectData(P)) await saveCurrentProject();
      setP(newP());
      if (genre) {
        P.genre = {name: genre.name, style: genre.style};
        P.projectMode = 'new';
        P.format = 'film';
        P.ratio = '16:9';
      }
      page = KEYS.list.length ? 1 : 0;
      setScreen('studio');
    } catch (e) {
      toast('Impossible de préparer le projet : ' + (e.message || 'erreur inconnue'));
    }
  }

  function showActivity() {
    const entries = [...document.querySelectorAll('#lb .lg')].slice(-12).reverse();
    const html = entries.length
      ? `<div class="portal-log-list">${entries.map(entry => `<div class="portal-log-entry"><time>${esc(entry.textContent.slice(0, 10))}</time>${esc(entry.textContent.slice(10).trim())}</div>`).join('')}</div>`
      : '<div class="portal-empty"><div><h3>Aucune activité récente</h3><p>Les étapes de génération et les erreurs apparaîtront ici.</p></div></div>';
    document.getElementById('mdc').innerHTML = `<h2>Activité récente</h2><p class="sub">Messages du projet et du stockage sur cet appareil.</p>${html}<div class="rw"><button type="button" class="portal-primary-button" data-a="portal-open-log">Ouvrir le journal complet</button><button type="button" data-a="closemd">Fermer</button></div>`;
    document.getElementById('md').classList.add('on');
  }

  async function openProject(id) {
    let project = await dbGet('sessions', id);
    if (!project) project = portalRows.find(item => item.id === id);
    if (!project) {
      toast('Ce projet n’est plus disponible dans la galerie.');
      await drawPortal();
      return;
    }
    setP(project);
    page = KEYS.list.length ? Math.max(1, Math.min(6, Number(project.page || 1))) : 0;
    setScreen('studio');
    resume();
  }

  async function deleteProject(id) {
    const project = portalRows.find(item => item.id === id);
    if (!confirm(`Supprimer « ${project ? projectTitle(project) : 'ce projet'} » de ce navigateur ?`)) return;
    await dbDel('sessions', id);
    if (P && P.id === id) {
      setP(newP());
      page = KEYS.list.length ? 1 : 0;
    }
    portalRows = portalRows.filter(item => item.id !== id);
    toast('Projet supprimé de cette galerie.');
    await drawPortal();
  }

  async function saveProviderSettings() {
    const agnesKeys = [...new Set(document.getElementById('portal-agnes-keys').value
      .split(/[\s,;]+/).map(value => value.trim()).filter(value => value.length >= 8))];
    const groqKeys = [...new Set(document.getElementById('portal-groq-keys').value
      .split(/[\s,;]+/).map(value => value.trim()).filter(value => value.startsWith('gsk_') || value.length >= 20))];
    const textProvider = document.getElementById('portal-text-provider').value;
    if (textProvider === 'groq' && !groqKeys.length) {
      toast('Ajoutez une clé Groq ou sélectionnez Agnès comme fournisseur principal.');
      return;
    }
    const plan = document.getElementById('portal-agnes-plan').value === 'plan' ? 'plan' : 'free';
    KEYS.plan = plan;
    KEYS.list = agnesKeys.map(key => KEYS.list.find(item => item.k === key) || mkKey(key));
    await dbPut('config', {key: 'keys', list: agnesKeys, plan});
    Object.assign(window.CGCFG, {
      groqKeys,
      groqModel: document.getElementById('portal-groq-model').value.trim() || 'openai/gpt-oss-20b',
      textProvider,
      fallbackEnabled: document.getElementById('portal-fallback').checked,
      fallbackProvider: 'agnes'
    });
    await dbPut('config', {key: 'providers', ...window.CGCFG});
    if (P && P.textProvider === 'groq' && !groqKeys.length) P.textProvider = 'auto';
    save();
    toast('Réglages enregistrés sur cet appareil.');
    setScreen('home');
  }

  async function shareProject() {
    await saveCurrentProject();
    const filename = `${(P.title || 'projet-fusion-ai').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'projet-fusion-ai'}.json`;
    const blob = new Blob([JSON.stringify(P, null, 2)], {type: 'application/json'});
    try {
      const file = new File([blob], filename, {type: 'application/json'});
      if (navigator.share && navigator.canShare && navigator.canShare({files: [file]})) {
        await navigator.share({title: P.title || 'Projet Fusion AI', text: 'Projet Fusion AI exporté au format JSON.', files: [file]});
        toast('Fichier du projet partagé.');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Export JSON téléchargé. Il contient les données de ce projet.');
  }

  const previousClick = onClick;
  onClick = async function (event) {
    const button = event.target.closest('[data-a]');
    if (!button) return previousClick(event);
    const action = button.dataset.a;

    if (action === 'portal-route') {
      event.preventDefault();
      if (button.dataset.screen === 'studio') openStudio();
      else setScreen(button.dataset.screen);
      return;
    }
    if (action === 'portal-create') {
      event.preventDefault();
      await startNewProject();
      return;
    }
    if (action === 'portal-open-tool') {
      event.preventDefault();
      const targetStep = Number(button.dataset.step);
      if (!hasProjectData(P) || !P.genre) {
        page = KEYS.list.length ? 1 : 0;
        setScreen('studio');
        toast('Choisissez d’abord le genre et le format du projet.');
      } else {
        openStudio(targetStep);
      }
      return;
    }
    if (action === 'portal-inspire') {
      event.preventDefault();
      await startNewProject({name: button.dataset.genre, style: button.dataset.style});
      return;
    }
    if (action === 'portal-search') {
      event.preventDefault();
      searchTerm = '';
      activeFilter = 'all';
      setScreen('gallery');
      setTimeout(() => document.getElementById('portal-search-input')?.focus(), 50);
      return;
    }
    if (action === 'portal-notifications') {
      event.preventDefault();
      showActivity();
      return;
    }
    if (action === 'portal-open-log') {
      event.preventDefault();
      document.getElementById('md').classList.remove('on');
      document.getElementById('con').classList.add('on');
      return;
    }
    if (action === 'portal-filter') {
      event.preventDefault();
      activeFilter = button.dataset.filter || 'all';
      document.querySelectorAll('.portal-filter-button[data-filter]').forEach(item => item.classList.toggle('is-active', item === button));
      updateGalleryCards();
      return;
    }
    if (action === 'portal-open') {
      event.preventDefault();
      await openProject(button.dataset.id);
      return;
    }
    if (action === 'portal-delete') {
      event.preventDefault();
      await deleteProject(button.dataset.id);
      return;
    }
    if (action === 'portal-settings-save') {
      event.preventDefault();
      await saveProviderSettings();
      return;
    }
    if (action === 'portal-save-project') {
      event.preventDefault();
      await saveCurrentProject();
      toast('Projet enregistré dans votre galerie locale.');
      setScreen('gallery');
      return;
    }
    if (action === 'portal-save-share') {
      event.preventDefault();
      await shareProject();
      return;
    }
    return previousClick(event);
  };

  document.addEventListener('input', event => {
    const target = event.target;
    if (target && target.id === 'portal-search-input') {
      searchTerm = target.value;
      updateGalleryCards();
    }
    if (target && target.id === 'portal-tags' && P) {
      P.tags = [...new Set(target.value.split(',').map(item => item.trim()).filter(Boolean))];
      save();
    }
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (!target || !P || !target.dataset.portalProjectField) return;
    if (target.dataset.portalProjectField === 'dialogueLang') P.dialogueLang = target.value === 'ht' ? 'ht' : 'fr';
    if (target.dataset.portalProjectField === 'voiceMode' && ['integrated', 'silent', 'capcut'].includes(target.value)) P.voiceMode = target.value;
    save();
    toast('Préférence du projet enregistrée.');
  });

  render = function (keep) {
    originalRender(keep);
    updateNav();
    if (screen !== 'studio') drawPortal();
  };

  window.addEventListener('popstate', () => {
    const next = (location.hash || '').slice(1);
    screen = allowedScreens.has(next) ? next : 'home';
    render();
  });

  updateNav();
  if (screen === 'studio') renderStage();
  else drawPortal();
})();

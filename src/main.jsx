import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { siteConfig } from './config';
import { initialSave } from './initialSave';
import './styles.css';

const STORAGE_KEY = 'cookie-vault-content-v1';
const ADMIN_SESSION_KEY = 'cookie-vault-admin';
const PASSWORD_SALT = '473a8fe13c06f3cd80e26f653240a27e';
const PASSWORD_HASH = 'c1e7f6db7508fb676c8ff51d268d3b95e4813b61896464843a123400b2844728';

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function verifyPassword(password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(PASSWORD_SALT), iterations: 310000 }, material, 256);
  const candidate = new Uint8Array(bits);
  const expected = hexToBytes(PASSWORD_HASH);
  let difference = candidate.length ^ expected.length;
  candidate.forEach((byte, index) => { difference |= byte ^ expected[index]; });
  return difference === 0;
}

async function sha256(text) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomInt(max) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % max;
}

function embedRgbLsb(context, width, height, message) {
  const pixels = context.getImageData(0, 0, width, height);
  const bytes = new TextEncoder().encode(`${message}\0`);
  const bits = [];
  bytes.forEach(byte => {
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((byte >> bit) & 1);
  });
  bits.forEach((bit, index) => {
    const pixel = Math.floor(index / 3);
    const channel = index % 3;
    const dataIndex = pixel * 4 + channel;
    pixels.data[dataIndex] = (pixels.data[dataIndex] & 0xfe) | bit;
  });
  context.putImageData(pixels, 0, 0);
}

async function createVisualChallenge() {
  const digits = Array.from({ length: 6 }, () => String(randomInt(10)));
  return { digits, answerHash: await sha256(digits.join('')), seed: randomInt(1000000) };
}

function loadContent() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && typeof stored === 'object') return { ...siteConfig, ...stored };
  } catch { /* use the published content */ }
  return siteConfig;
}

function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getYoutubeId(url = '') {
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)?.[1];
}

function MediaCard({ item }) {
  const youtubeId = item.type === 'video' ? getYoutubeId(item.url) : null;
  return <figure className={`media-card ${item.type}`}>
    {item.type === 'video' ? (
      youtubeId
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title={item.caption || 'Vídeo'} allowFullScreen />
        : <video src={item.url} controls preload="metadata" />
    ) : <img src={item.url} alt={item.caption || 'Imagem da galeria'} />}
    {item.caption && <figcaption>{item.caption}</figcaption>}
  </figure>;
}

function AdminLogin({ onSuccess, onClose }) {
  const [password, setPassword] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState(1);
  const [keyVisible, setKeyVisible] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const canvas = useRef(null);

  useEffect(() => {
    if (stage !== 2 || !challenge || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    const width = canvas.current.width;
    const height = canvas.current.height;
    const hue = challenge.seed % 360;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `hsl(${hue} 80% 16%)`);
    gradient.addColorStop(.52, `hsl(${(hue + 72) % 360} 85% 48%)`);
    gradient.addColorStop(1, `hsl(${(hue + 180) % 360} 70% 12%)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const sunX = 90 + randomInt(width - 180);
    const sunY = 35 + randomInt(45);
    const sun = context.createRadialGradient(sunX, sunY, 2, sunX, sunY, 62);
    sun.addColorStop(0, '#fffbd1'); sun.addColorStop(.25, '#ffcf70'); sun.addColorStop(1, '#ff4f9a00');
    context.fillStyle = sun; context.fillRect(0, 0, width, height);
    const drawCookie = (x, y, radius, alpha = 1) => {
      context.save(); context.globalAlpha = alpha; context.translate(x, y); context.rotate(randomInt(628) / 100);
      const cookieGradient = context.createRadialGradient(-radius * .3, -radius * .35, radius * .1, 0, 0, radius);
      cookieGradient.addColorStop(0, '#ffd58a'); cookieGradient.addColorStop(.68, '#c97834'); cookieGradient.addColorStop(1, '#713516');
      context.fillStyle = cookieGradient; context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#ffe3aa55'; context.lineWidth = Math.max(1, radius * .05); context.stroke();
      for (let chip = 0; chip < Math.max(5, Math.round(radius / 5)); chip += 1) {
        const angle = randomInt(628) / 100; const distance = radius * (.18 + randomInt(58) / 100);
        context.fillStyle = chip % 2 ? '#3a170e' : '#5a2412'; context.beginPath();
        context.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(1.4, radius * .075), 0, Math.PI * 2); context.fill();
      }
      context.restore();
    };
    drawCookie(sunX, sunY, 42, .92);
    for (let layer = 0; layer < 4; layer += 1) {
      const base = 95 + layer * 24;
      context.beginPath(); context.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        const y = base + Math.sin((x + challenge.seed * (layer + 1)) / (24 + layer * 9)) * (18 + layer * 5) + Math.sin(x / 11) * 5;
        context.lineTo(x, y);
      }
      context.lineTo(width, height); context.closePath();
      context.fillStyle = `hsla(${(hue + 150 + layer * 28) % 360} 70% ${26 - layer * 3}% / ${.62 + layer * .09})`;
      context.fill();
    }
    for (let i = 0; i < 80; i += 1) {
      context.fillStyle = `hsla(${(hue + randomInt(180)) % 360} 90% 75% / ${.08 + randomInt(18) / 100})`;
      context.beginPath(); context.arc(randomInt(width), randomInt(height), 1 + randomInt(7), 0, Math.PI * 2); context.fill();
    }
    for (let i = 0; i < 13; i += 1) drawCookie(20 + randomInt(width - 40), 18 + randomInt(height - 36), 5 + randomInt(14), .25 + randomInt(45) / 100);
    context.strokeStyle = '#ffffff20'; context.strokeRect(10.5, 10.5, width - 21, height - 21);
    embedRgbLsb(context, width, height, `COOKIE_VAULT::${challenge.digits.join('')}::END`);
  }, [stage, challenge]);

  useEffect(() => {
    if (stage !== 2 || keyVisible) return undefined;
    const reveal = event => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setKeyVisible(true);
      }
    };
    window.addEventListener('keydown', reveal);
    return () => window.removeEventListener('keydown', reveal);
  }, [stage, keyVisible]);

  useEffect(() => {
    if (stage !== 2) return undefined;
    const exportImage = event => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'd' && canvas.current) {
        event.preventDefault();
        const link = document.createElement('a');
        link.download = 'cookie-vision.png';
        link.href = canvas.current.toDataURL('image/png');
        link.click();
      }
    };
    window.addEventListener('keydown', exportImage);
    return () => window.removeEventListener('keydown', exportImage);
  }, [stage]);

  const submit = async event => {
    event.preventDefault();
    setChecking(true);
    const valid = stage === 1
      ? await verifyPassword(password)
      : await sha256(answer.trim()) === challenge.answerHash;
    setChecking(false);
    if (!valid) {
      setError(stage === 1 ? 'Credencial inválida.' : 'Verificação recusada.');
      if (stage === 1) setPassword('');
      return;
    }
    if (stage === 1) {
      setChallenge(await createVisualChallenge());
      setStage(2);
      setError('');
    } else onSuccess();
  };
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className={`admin-login ${stage === 2 ? `visual-login ${keyVisible ? 'key-open' : ''}` : ''}`} onSubmit={submit}>
      <button className="icon-button login-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      {stage === 1 && <><span className="admin-lock">⌁</span><span className="eyebrow">ACESSO RESTRITO · 01</span><h2>Administrador</h2></>}
      {stage === 1 && <><p>Confirme sua credencial para continuar.</p><label>Credencial<input autoFocus type="password" autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError(''); }} /></label></>}
      {stage === 2 && <><canvas className="crypto-canvas landscape" ref={canvas} width="620" height="280" />{keyVisible && <label className="revealed-key">Chave<input autoFocus inputMode="numeric" value={answer} onChange={event => { setAnswer(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} autoComplete="off" /></label>}</>}
      {error && <span className="login-error" role="alert">{error}</span>}
      {(stage === 1 || keyVisible) && <button className="primary login-submit" disabled={checking}>{checking ? 'Verificando…' : 'Continuar'}</button>}
      {stage === 1 && <small>Sessão administrativa local</small>}
    </form>
  </div>;
}

function Editor({ content, onSave, onClose, onReset }) {
  const [draft, setDraft] = useState(content);
  const [editorMessage, setEditorMessage] = useState('');
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const updateMedia = (index, field, value) => update('media', draft.media.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const addMedia = type => update('media', [...draft.media, { type, url: '', caption: '' }]);
  const addImageFile = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_500_000) {
      setEditorMessage('A imagem precisa ter no máximo 1,5 MB para caber no armazenamento do navegador.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update('media', [...draft.media, { type: 'image', url: String(reader.result), caption: file.name }]);
      setEditorMessage('Foto adicionada. Salve as alterações para guardar neste navegador.');
    };
    reader.readAsDataURL(file);
  };

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <header className="editor-head">
        <div><span className="eyebrow">PAINEL LOCAL</span><h2 id="editor-title">Editar página</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <p className="editor-note">As mudanças ficam salvas neste navegador. Exporte a configuração para transformá-las na versão publicada.</p>
      <h3 className="editor-section-title">Informações da página</h3>
      <div className="form-grid">
        <label>Nome<input value={draft.name} onChange={e => update('name', e.target.value)} /></label>
        <label>Desde o ano<input value={draft.year} onChange={e => update('year', e.target.value)} /></label>
        <label className="wide">Título<input value={draft.title} onChange={e => update('title', e.target.value)} /></label>
        <label className="wide">Descrição<textarea rows="3" value={draft.description} onChange={e => update('description', e.target.value)} /></label>
        <label className="wide">URL da foto de perfil<input value={draft.profileImage} onChange={e => update('profileImage', e.target.value)} /></label>
        <label className="wide">URL do GitHub<input value={draft.github} onChange={e => update('github', e.target.value)} /></label>
        <label className="wide save-field">Código do save do Cookie Clicker <small>Cole aqui o código completo exportado pelo jogo.</small><textarea className="save-input" value={draft.save} onChange={e => update('save', e.target.value)} spellCheck="false" /></label>
      </div>
      <div className="media-editor-head"><div><h3>Galeria</h3><small>Adicione uma foto do computador ou use links públicos.</small></div><div><label className="upload-button">↑ Enviar foto<input type="file" accept="image/*" onChange={addImageFile} /></label><button onClick={() => addMedia('image')}>+ URL de foto</button><button onClick={() => addMedia('video')}>+ URL de vídeo</button></div></div>
      {editorMessage && <p className="editor-message">{editorMessage}</p>}
      <div className="media-editor">
        {draft.media.map((item, index) => <div className="media-row" key={index}>
          <select value={item.type} onChange={e => updateMedia(index, 'type', e.target.value)}><option value="image">Foto</option><option value="video">Vídeo</option></select>
          <input aria-label="URL da mídia" placeholder="URL da imagem, vídeo ou YouTube" value={item.url} onChange={e => updateMedia(index, 'url', e.target.value)} />
          <input aria-label="Legenda" placeholder="Legenda" value={item.caption} onChange={e => updateMedia(index, 'caption', e.target.value)} />
          <button className="remove" onClick={() => update('media', draft.media.filter((_, i) => i !== index))} aria-label="Remover mídia">×</button>
        </div>)}
      </div>
      <footer className="editor-actions">
        <button className="text-button danger" onClick={onReset}>Restaurar publicado</button>
        <button className="text-button" onClick={() => downloadText(JSON.stringify(draft, null, 2), 'cookie-vault-config.json', 'application/json')}>Exportar configuração</button>
        <button className="primary" onClick={() => onSave(draft)}>Salvar neste navegador</button>
      </footer>
    </section>
  </div>;
}

function App() {
  const [content, setContent] = useState(() => {
    const loaded = loadContent();
    return { ...loaded, save: loaded.save || localStorage.getItem('cookie-clicker-save') || initialSave, media: loaded.media || [] };
  });
  const [admin, setAdmin] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'active');
  const [loginOpen, setLoginOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const listen = event => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (!admin) setLoginOpen(true);
        else setEditing(true);
      }
    };
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  }, [admin]);

  const media = useMemo(() => content.media.filter(item => item.url.trim()), [content.media]);
  const flash = message => { setNotice(message); window.setTimeout(() => setNotice(''), 1800); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(content.save); flash('Save copiado!'); }
    catch { flash('Não foi possível copiar'); }
  };
  const persist = updated => {
    setContent(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('cookie-clicker-save', updated.save);
    setEditing(false);
    flash('Alterações salvas neste navegador');
  };
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('cookie-clicker-save');
    setContent({ ...siteConfig, save: siteConfig.save || initialSave, media: siteConfig.media || [] });
    setEditing(false);
    flash('Versão publicada restaurada');
  };
  const unlockAdmin = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'active');
    setAdmin(true);
    setLoginOpen(false);
    setEditing(true);
    flash('Modo administrador liberado');
  };
  const lockAdmin = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdmin(false);
    setEditing(false);
    flash('Modo administrador encerrado');
  };

  return <>
    <header className="topbar">
      <a className="brand" href="#top"><span className="cookie-mark">●</span> COOKIE VAULT</a>
      <nav><a href="#save">SAVE</a><a href="#galeria">GALERIA</a><a href={content.github} target="_blank" rel="noreferrer">GITHUB ↗</a></nav>
      {admin && <div className="admin-buttons"><button className="edit-button" onClick={() => setEditing(true)}>✎ Editar página</button><button className="lock-button" onClick={lockAdmin} title="Sair do modo administrador">Sair</button></div>}
    </header>
    <main id="top">
      <section className="hero">
        <div className="profile-picture"><img src={content.profileImage} alt={`Foto de ${content.name}`} /><span /></div>
        <div className="hero-copy"><span className="eyebrow">ARQUIVO PESSOAL · DESDE {content.year}</span><h1>{content.title}</h1><p>{content.description}</p><div className="author"><b>@{content.name}</b><span>Cookie Clicker player</span></div></div>
      </section>
      <section className="save-section" id="save">
        <div className="section-heading"><div><span className="eyebrow">SAVE PRINCIPAL</span><h2>Pronto para importar.</h2></div><div className="heading-actions">{admin && <button className="inline-edit" onClick={() => setEditing(true)}>✎ Editar código</button>}<span className="status"><i /> ARQUIVO DISPONÍVEL</span></div></div>
        <div className="gist-card">
          <div className="gist-bar"><span><b>cookie-clicker-save.txt</b><small>texto · {content.save.length.toLocaleString('pt-BR')} caracteres</small></span><button onClick={copy}>Copiar</button></div>
          <pre><code>{content.save}</code></pre>
          <div className="gist-actions"><button className="primary" onClick={copy}>⧉ Copiar save</button><button onClick={() => downloadText(content.save, 'cookie-clicker-save.txt')}>↓ Fazer download</button><label>↑ Importar arquivo<input type="file" accept=".txt,text/plain" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => persist({ ...content, save: String(reader.result || '') }); reader.readAsText(file); event.target.value = ''; }} /></label></div>
        </div>
        <p className="hint">No Cookie Clicker, abra <b>Options → Import save</b> e cole o código copiado.</p>
      </section>
      <section className="gallery-section" id="galeria">
        <div className="section-heading"><div><span className="eyebrow">MEMÓRIAS DO SAVE</span><h2>Galeria</h2></div><div className="heading-actions"><p>Imagens e vídeos desta jornada.</p>{admin && <button className="inline-edit" onClick={() => setEditing(true)}>✎ Editar galeria</button>}</div></div>
        {media.length ? <div className="gallery">{media.map((item, index) => <MediaCard item={item} key={`${item.url}-${index}`} />)}</div> : <div className="empty-gallery"><span>▧</span><b>A galeria está pronta.</b><p>Use o acesso de administrador para adicionar fotos e vídeos.</p></div>}
      </section>
    </main>
    <footer className="site-footer"><span><i className="cookie-mark">●</i> COOKIE VAULT</span><p>Um pequeno pedaço da história da internet, preservado por <b>@{content.name}</b>.</p></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
    {loginOpen && <AdminLogin onSuccess={unlockAdmin} onClose={() => setLoginOpen(false)} />}
    {editing && <Editor content={content} onSave={persist} onClose={() => setEditing(false)} onReset={reset} />}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);

// 텍스트 노드 재귀 수집
function collectTextNodes(node, results) {
  if (node.type === 'TEXT') {
    const text = node.characters.trim();
    if (text.length > 0) {
      results.push({ id: node.id, text });
    }
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectTextNodes(child, results);
    }
  }
}

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'init') {
    const sel = figma.currentPage.selection;
    figma.ui.postMessage({
      type: 'selection',
      count: sel.length,
      names: sel.map(n => n.name).slice(0, 3),
    });
    return;
  }

  if (msg.type === 'get_usage') {
    const count = (await figma.clientStorage.getAsync('usage_' + msg.date)) || 0;
    figma.ui.postMessage({ type: 'usage_data', count });
    return;
  }

  if (msg.type === 'set_usage') {
    await figma.clientStorage.setAsync('usage_' + msg.date, msg.count);
    return;
  }

  if (msg.type === 'translate') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'error', message: '번역할 프레임을 먼저 선택해주세요.' });
      return;
    }

    const textNodes = [];
    for (const node of selection) {
      collectTextNodes(node, textNodes);
    }

    if (textNodes.length === 0) {
      figma.ui.postMessage({ type: 'error', message: '선택된 프레임에 텍스트가 없습니다.' });
      return;
    }

    // UI에서 번역 API 호출하도록 전달
    figma.ui.postMessage({
      type: 'do_translate',
      texts: textNodes,
      direction: msg.direction,
      email: msg.email,
    });
  }

  if (msg.type === 'apply_translations') {
    const { translations } = msg;
    let applied = 0;
    let failed = 0;

    for (const { id, translated } of translations) {
      const node = figma.getNodeById(id);
      if (!node || node.type !== 'TEXT') continue;

      try {
        if (node.fontName === figma.mixed) {
          const fonts = new Set();
          for (let i = 0; i < node.characters.length; i++) {
            const fn = node.getRangeFontName(i, i + 1);
            if (fn !== figma.mixed) fonts.add(JSON.stringify(fn));
          }
          for (const f of fonts) await figma.loadFontAsync(JSON.parse(f));
        } else {
          await figma.loadFontAsync(node.fontName);
        }
        node.characters = translated;
        applied++;
      } catch (e) {
        failed++;
      }
    }

    figma.ui.postMessage({ type: 'done', applied, failed });
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

figma.showUI(__html__, { width: 320, height: 460, title: '한↔영 번역기 (무료)' });

figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection;
  figma.ui.postMessage({
    type: 'selection',
    count: sel.length,
    names: sel.map(n => n.name).slice(0, 3),
  });
});

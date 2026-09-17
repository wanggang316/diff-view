import { test, expect } from '@playwright/test';
test('document refresh preserves the user layout until the host changes options', async ({ page }) => {
  await page.goto('/demo.html');
  await page.getByRole('button', { name: 'Unified', exact: true }).click();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  for (const path of ['Sources/WorktreeService.swift', 'Sources/AnotherFile.swift']) {
    await page.evaluate(path => (window as any).diffView.render({
      id: path, path, oldText: 'let value = 1\n', newText: 'let value = 3\n',
    }), path);
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.d2h-file-side-diff')).toHaveCount(2);
  }
  await page.evaluate(() => (window as any).diffView.render({
    id: 'host-options', path: 'Source.swift', oldText: 'let value = 1\n', newText: 'let value = 4\n',
  }, { layout: 'unified', theme: 'light' }));
  await expect(page.getByRole('button', { name: 'Unified', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('native host documents without language still receive syntax highlighting', async ({ page }) => {
  await page.goto('/demo.html');
  for (const [path, newText] of [
    ['src/main.swift', 'let value = 2\n'],
    ['src/main.js', 'const value = 2;\n'],
    ['src/main.ts', 'const value: number = 2;\n'],
    ['src/main.py', 'def example():\n    return 2\n'],
    ['src/main.go', 'func example() int { return 2 }\n'],
  ]) {
    await page.evaluate(({ path, newText }) => (window as any).diffView.render({
      id: path, path, oldText: '', newText,
    }), { path, newText });
    await expect(page.locator('.hljs-keyword').first()).toBeVisible();
  }
});
test('offline rendering, modes, exact native event, hostile content and recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).messages = [];
    (window as any).webkit = { messageHandlers: { diffView: { postMessage: (value: unknown) => (window as any).messages.push(value) } } };
  });
  await page.goto('/demo.html');
  await expect(page.locator('#path')).toHaveText('Sources/WorktreeService.swift');
  await expect(page.locator('.d2h-file-side-diff')).toHaveCount(2);
  await expect(page.locator('.hljs-keyword').first()).toBeVisible();
  await page.locator('.d2h-file-side-diff').last().locator('.d2h-code-side-linenumber').filter({ hasText: /^\s*8\s*$/ }).first().dblclick();
  expect(await page.evaluate(() => (window as any).messages.findLast((event: any) => event.type === 'openFile'))).toMatchObject({ side: 'new', line: 8 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Unified', exact: true }).click();
  await expect(page.locator('.d2h-file-side-diff')).toHaveCount(0);
  await page.locator('.line-num2').filter({ hasText: /^\s*8\s*$/ }).first().dblclick();
  expect(await page.evaluate(() => (window as any).messages.findLast((event: any) => event.type === 'openFile'))).toMatchObject({ type: 'openFile', documentID: 'worktree-service:1', path: 'Sources/WorktreeService.swift', side: 'new', line: 8 });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => (window as any).diffView.render({ id:'hostile', path:'<img src=x onerror="window.pwned=1">\n".ts', oldText:'', newText:'<script>window.pwned=1</script>\n' }));
  await expect(page.locator('#diff')).toContainText('<script>window.pwned=1</script>');
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
  await expect(page.locator('#diff script, #diff img')).toHaveCount(0);
  await page.evaluate(() => (window as any).diffView.render({ id:'large', path:'x', oldText:'', newText:'x'.repeat(1_000_001) }));
  await expect(page.locator('#diff')).toContainText('preview limit');
  await expect(page.locator('#open')).toHaveCount(0);
  await page.evaluate(() => (window as any).diffView.render({ id:'same', path:'same.txt', oldText:'same', newText:'same' }));
  await expect(page.locator('#diff')).toContainText('No content changes');
  expect(errors).toEqual([]);
});
test('narrow layout is usable and code is selectable', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await page.goto('/demo.html');
  await page.getByRole('button', { name: 'Unified', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open file' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await page.locator('.d2h-code-line-ctn').first().evaluate(el => getComputedStyle(el).userSelect)).not.toBe('none');
  await page.screenshot({ path: 'test-results/narrow.png', fullPage: true });
});

test('native chrome is edge-to-edge, follows host options and retains exact line events', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).messages = [];
    window.addEventListener('diff-view', (event: any) => (window as any).messages.push(event.detail));
  });
  await page.goto('/demo.html');
  for (const layout of ['unified', 'split']) {
    await page.evaluate(layout => (window as any).diffView.render({
      id: 'native', path: 'Example.swift', oldText: 'let value = 1\n', newText: 'let value = 2\n',
    }, { layout, theme: 'light', chrome: 'none' }), layout);
    for (const selector of ['.toolbar', '.context', 'footer']) {
      await expect(page.locator(selector)).toBeHidden();
    }
    expect(await page.locator('#diff').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    expect(await page.locator('#diff').evaluate(el => getComputedStyle(el).padding)).toBe('0px');
    const line = layout === 'unified' ? page.locator('.line-num2').filter({ hasText: /^\s*1\s*$/ })
      : page.locator('.d2h-file-side-diff').last().locator('.d2h-code-side-linenumber').filter({ hasText: /^\s*1\s*$/ });
    await line.first().dblclick();
    expect(await page.evaluate(() => (window as any).messages.findLast((event: any) => event.type === 'openFile')))
      .toMatchObject({ documentID: 'native', path: 'Example.swift', side: 'new', line: 1 });
    await page.screenshot({ path: `test-results/native-${layout}.png` });
  }
  await page.evaluate(() => (window as any).diffView.render({ id: 'error', path: 'large', oldText: '', newText: 'x'.repeat(1_000_001) }));
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#diff')).toContainText('preview limit');
  await page.evaluate(() => (window as any).diffView.render({ id: 'full', path: 'Example.swift', oldText: 'a', newText: 'b' }, { layout: 'unified', theme: 'dark' }));
  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

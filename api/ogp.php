<?php
// OGP チェッカー（../ogp-checker/）の調べ役
//
//   GET ogp.php?url=https://example.com/&ua=discord
//
// 指定したページを取ってきて、OGP・X のカードなどのタグと、画像の大きさ・ページの重さを JSON で返す。
// ブラウザからは、よそのサイトのページを読めない（CORS）ので、ここで代わりに取ってくる。
//
// 安全に取りに行く決まり（行き先の確かめ・上限・回数・呼べるページ）は _net.php にまとめてある。

declare(strict_types=1);

require __DIR__ . '/_net.php';

const OGP_MAX_HTML      = 3 * 1024 * 1024;  // ページを読む上限
const OGP_MAX_IMAGE     = 10 * 1024 * 1024; // 画像を読む上限

const OGP_UAS = [
	'default'  => 'Mozilla/5.0 (compatible; donnma-ogp-checker/1.0; +https://donnma.com/tool/ogp-checker/)',
	'discord'  => 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
	'x'        => 'Twitterbot/1.0',
	'facebook' => 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
	'line'     => 'facebookexternalhit/1.1;line-poker/1.0',
	'slack'    => 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
	'bluesky'  => 'Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)',
	'mastodon' => 'http.rb/5.2.0 (Mastodon/4.3.0; +https://mastodon.social/) Bot',
	'misskey'  => 'Mozilla/5.0 (compatible; SummalyBot/5.1.0; +https://github.com/misskey-dev/summaly/blob/master/README.md)',
	'linkedin' => 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
	'telegram' => 'TelegramBot (like TwitterBot)',
	'whatsapp' => 'WhatsApp/2.24.20.89 A',
	'imessage' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
	'teams'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com',
	'pinterest' => 'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)',
	'reddit'   => 'Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)',
];

ogp_start();

$url = ogp_input_url();
$uaKey = (string)($_GET['ua'] ?? 'default');
if (! isset(OGP_UAS[$uaKey])) $uaKey = 'default';

// ---- ページを読む

$chain = [];
$page = ogp_fetch($url, OGP_UAS[$uaKey], OGP_MAX_HTML, $chain);
if (isset($page['error'])) ogp_fail($page['error']);

$html = $page['body'];
$ctype = $page['headers']['content-type'] ?? '';

// 文字コードを UTF-8 にそろえる
$charset = '';
if (preg_match('/charset=["\']?([\w-]+)/i', $ctype, $m)) $charset = $m[1];
elseif (preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($html, 0, 4096), $m)) $charset = $m[1];
if ($charset !== '' && ! preg_match('/^utf-?8$/i', $charset)) {
	$conv = @mb_convert_encoding($html, 'UTF-8', $charset);
	if (is_string($conv)) $html = $conv;
}

// <meta> を全部ひろう（どこにあったかの位置も）
$metas = [];
if (preg_match_all('/<meta\b[^>]*>/is', $html, $mm, PREG_OFFSET_CAPTURE)) {
	foreach ($mm[0] as [$tag, $pos]) {
		$attrs = [];
		preg_match_all('/([\w:-]+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/s', $tag, $am, PREG_SET_ORDER);
		foreach ($am as $a) $attrs[strtolower($a[1])] = html_entity_decode($a[2] !== '' ? $a[2] : ($a[3] !== '' ? $a[3] : ($a[4] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
		$key = $attrs['property'] ?? $attrs['name'] ?? $attrs['itemprop'] ?? null;
		if ($key === null || ! isset($attrs['content'])) continue;
		$metas[] = ['key' => strtolower($key), 'value' => $attrs['content'], 'pos' => $pos];
	}
}
$first = function (string $key) use ($metas) {
	foreach ($metas as $m) if ($m['key'] === $key) return $m;
	return null;
};
$title = preg_match('/<title\b[^>]*>(.*?)<\/title>/is', $html, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')) : null;
$canonical = preg_match('/<link\b[^>]*rel=["\']?canonical["\']?[^>]*>/i', $html, $m) && preg_match('/href=["\']([^"\']+)/i', $m[0], $h) ? ogp_abs($h[1], $page['url']) : null;
// HTML になければ、返事のヘッダーの Link: <…>; rel="canonical" を見る（PukiWiki などはこちらで送る）
$canonicalFrom = $canonical ? 'html' : null;
if (! $canonical && preg_match('/<([^>]+)>\s*;[^,]*\brel="?canonical\b/i', $page['headers']['link'] ?? '', $m)) {
	$canonical = ogp_abs($m[1], $page['url']);
	$canonicalFrom = 'header';
}
$icon = null;
if (preg_match_all('/<link\b[^>]*>/i', $html, $lm)) {
	foreach ($lm[0] as $l) {
		if (preg_match('/rel=["\']?([^"\'>]+)/i', $l, $r) && preg_match('/\bicon\b/i', $r[1]) && preg_match('/href=["\']([^"\']+)/i', $l, $h)) {
			$icon = ogp_abs($h[1], $page['url']); break;
		}
	}
}
$headEnd = stripos($html, '</head>');

// ---- 画像を確かめる（og:image と twitter:image）

function ogp_image_info(string $src, string $ua): array
{
	$chain = [];
	$r = ogp_fetch($src, $ua, OGP_MAX_IMAGE, $chain);
	if (isset($r['error'])) return ['url' => $src, 'error' => $r['error']];
	$info = ['url' => $r['url'], 'status' => $r['status'], 'type' => $r['headers']['content-type'] ?? '',
		'bytes' => $r['over'] ? null : strlen($r['body']), 'over' => $r['over'], 'time' => $r['time']];
	if ($r['status'] === 200 && ! $r['over']) {
		$sz = @getimagesizefromstring($r['body']);
		if ($sz) { $info['width'] = $sz[0]; $info['height'] = $sz[1]; $info['mime'] = $sz['mime']; }
		elseif (stripos($info['type'], 'svg') !== false) $info['mime'] = 'image/svg+xml';
	}
	return $info;
}

// ---- robots.txt：X・Slack・LinkedIn は、ページだけでなく画像も robots.txt で止められていると読まない
//（Discord・Facebook・LINE などは見ない）。止められているサービスの名前を返す
const OGP_ROBOTS_BOTS = ['X' => 'twitterbot', 'Slack' => 'slackbot', 'LinkedIn' => 'linkedinbot'];

function ogp_robots_blocked(string $url): array
{
	static $cache = [];
	$p = parse_url($url);
	if (empty($p['host'])) return [];
	$origin = strtolower($p['scheme'] ?? 'https') . '://' . strtolower($p['host']) . (isset($p['port']) ? ':' . $p['port'] : '');
	if (! isset($cache[$origin])) {
		$chain = [];
		$r = ogp_fetch($origin . '/robots.txt', OGP_UAS['default'], 512 * 1024, $chain);
		$cache[$origin] = (! isset($r['error']) && $r['status'] === 200) ? ogp_robots_parse($r['body']) : [];
	}
	$path = ($p['path'] ?? '/') . (isset($p['query']) ? '?' . $p['query'] : '');
	$out = [];
	foreach (OGP_ROBOTS_BOTS as $name => $bot) {
		if (! ogp_robots_allowed($cache[$origin], $bot, $path)) $out[] = $name;
	}
	return $out;
}

$images = [];
foreach (['og:image', 'twitter:image'] as $k) {
	$m = $first($k) ?? ($k === 'twitter:image' ? $first('twitter:image:src') : null);
	if (! $m || $m['value'] === '') continue;
	$abs = ogp_abs($m['value'], $page['url']);
	if (isset($images[$abs])) { $images[$abs]['for'][] = $k; continue; }
	$images[$abs] = ogp_image_info($abs, OGP_UAS[$uaKey]) + ['for' => [$k], 'raw' => $m['value'], 'robotsBlocked' => ogp_robots_blocked($abs)];
}

ogp_out([
	'ok'        => true,
	'url'       => $page['url'],
	'input'     => $url,
	'ua'        => $uaKey,
	'status'    => $page['status'],
	'chain'     => $chain,
	'time'      => $page['time'],
	'ttfb'      => $page['ttfb'],
	'bytes'     => strlen($page['body']),
	'over'      => $page['over'],
	'type'      => $ctype,
	'encoding'  => $page['headers']['content-encoding'] ?? null,
	'robots'    => $page['headers']['x-robots-tag'] ?? null,
	'robotsBlocked' => ogp_robots_blocked($page['url']),
	'headEnd'   => $headEnd === false ? null : $headEnd,
	'title'     => $title,
	'canonical' => $canonical,
	'canonicalFrom' => $canonicalFrom,
	'icon'      => $icon,
	'metas'     => $metas,
	'images'    => array_values($images),
]);

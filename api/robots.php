<?php
// robots.txt チェッカー（../robots-checker/）の調べ役
//
//   GET robots.php?url=https://example.com/some/page
//
// そのサイトの robots.txt の中身と返事、調べるページの noindex（meta・X-Robots-Tag）、
// robots.txt に書かれたサイトマップに届くかを JSON で返す。どのクローラーが読めるかの判定は、画面（JS）でする。
// 安全に取りに行く決まりは _net.php。

declare(strict_types=1);

require __DIR__ . '/_net.php';

const ROBOTS_MAX      = 512 * 1024;      // Google が読むのは 500KiB まで。少し多めに読んで、超えたかを見る
const ROBOTS_PAGE_MAX = 1024 * 1024;     // ページは頭だけ読めばよい
const ROBOTS_UA       = 'Mozilla/5.0 (compatible; donnma-robots-checker/1.0; +https://donnma.com/tool/robots-checker/)';
const ROBOTS_SITEMAPS = 3;               // 届くかを確かめるサイトマップの数

ogp_start();

$url = ogp_input_url();
if (! ogp_check_url($url, $t, $why)) ogp_fail($why);
$p = parse_url($url);
$origin = strtolower($p['scheme']) . '://' . strtolower($p['host']) . (isset($p['port']) ? ':' . $p['port'] : '');

// ---- robots.txt
$chain = [];
$r = ogp_fetch($origin . '/robots.txt', ROBOTS_UA, ROBOTS_MAX + 1, $chain);
$robots = ['url' => $origin . '/robots.txt', 'chain' => $chain];
if (isset($r['error'])) {
	$robots['error'] = $r['error'];
} else {
	$body = $r['body'];
	// 先頭の BOM は取る
	if (str_starts_with($body, "\xEF\xBB\xBF")) $body = substr($body, 3);
	$robots += [
		'finalUrl' => $r['url'],
		'status'   => $r['status'],
		'type'     => $r['headers']['content-type'] ?? '',
		'bytes'    => strlen($r['body']),
		'over'     => $r['over'] || strlen($r['body']) > ROBOTS_MAX,
		'time'     => $r['time'],
		'body'     => $r['status'] >= 200 && $r['status'] < 300 ? mb_convert_encoding(substr($body, 0, ROBOTS_MAX), 'UTF-8', 'UTF-8') : '',
	];
}

// ---- 調べるページ（noindex など）
$chain = [];
$pg = ogp_fetch($url, ROBOTS_UA, ROBOTS_PAGE_MAX, $chain);
$page = ['url' => $url, 'chain' => $chain];
if (isset($pg['error'])) {
	$page['error'] = $pg['error'];
} else {
	$html = $pg['body'];
	$metaRobots = [];
	if (preg_match_all('/<meta\b[^>]*>/is', $html, $mm)) {
		foreach ($mm[0] as $tag) {
			if (preg_match('/\bname\s*=\s*["\']?(robots|googlebot|bingbot|googlebot-news)["\'\s>]/i', $tag, $n) && preg_match('/\bcontent\s*=\s*(?:"([^"]*)"|\'([^\']*)\')/i', $tag, $c)) {
				$metaRobots[] = ['name' => strtolower($n[1]), 'content' => $c[1] !== '' ? $c[1] : ($c[2] ?? '')];
			}
		}
	}
	$page += [
		'finalUrl'   => $pg['url'],
		'status'     => $pg['status'],
		'type'       => $pg['headers']['content-type'] ?? '',
		'xRobots'    => $pg['headers']['x-robots-tag'] ?? null,
		'metaRobots' => $metaRobots,
	];
}

// ---- サイトマップに届くか（robots.txt に書かれたものを、頭の数個だけ）
$sitemaps = [];
if (! empty($robots['body']) && preg_match_all('/^\s*sitemap\s*:\s*(\S+)/im', $robots['body'], $sm)) {
	foreach (array_slice(array_unique($sm[1]), 0, ROBOTS_SITEMAPS) as $s) {
		$chain = [];
		$x = ogp_fetch($s, ROBOTS_UA, 64 * 1024, $chain);
		$sitemaps[] = isset($x['error'])
			? ['url' => $s, 'error' => $x['error']]
			: ['url' => $s, 'status' => $x['status'], 'type' => $x['headers']['content-type'] ?? '', 'redirected' => count($chain) > 1];
	}
}

ogp_out([
	'ok'       => true,
	'input'    => $url,
	'origin'   => $origin,
	'robots'   => $robots,
	'page'     => $page,
	'sitemaps' => $sitemaps,
]);

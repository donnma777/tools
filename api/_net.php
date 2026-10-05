<?php
// api/ の調べ役で使う共通の部品（ogp.php・robots.php から読み込む。これだけ開いても何もしない）
//
// 悪用されないように：
//   ・取りに行くのは http / https の 80・443 番だけ。社内ネットワークなど、外から見えないアドレスには行かない
//     （名前を引いた IP を確かめて、その IP に固定してつなぐ。転送先も毎回確かめる）
//   ・読む量と待つ時間に上限
//   ・同じ IP から短い時間に何度も呼べない（調べ役ぜんぶで数える）
//   ・呼べるのは donnma.com と tools.donnma.com のページから

declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const OGP_TIMEOUT       = 10;               // 1回の通信で待つ秒数
const OGP_MAX_REDIRECTS = 5;
const OGP_RATE_COUNT    = 30;               // この回数まで
const OGP_RATE_WINDOW   = 600;              // この秒数のあいだに

const OGP_ORIGINS = ['https://donnma.com', 'https://tools.donnma.com'];

// サービスごとの名乗り方（サイトによっては、相手によって返すページを変えるので）
// ---- 返事

function ogp_out(array $data, int $status = 200): void
{
	http_response_code($status);
	echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
	exit;
}

function ogp_fail(string $msg, int $status = 400): void
{
	ogp_out(['ok' => false, 'error' => $msg], $status);
}

// 呼ばれたときの最初の決まり：CORS・JSON のヘッダー、よそのページからは断る、回数の制限
function ogp_start(): void
{
	$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
	if (in_array($origin, OGP_ORIGINS, true)) header('Access-Control-Allow-Origin: ' . $origin);
	header('Vary: Origin');
	header('Content-Type: application/json; charset=utf-8');
	header('Cache-Control: no-store');
	header('X-Content-Type-Options: nosniff');
	if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') exit;
	// よそのサイトのページから呼ばれたら断る（ブラウザが Origin を付けてくるとき）
	if ($origin !== '' && ! in_array($origin, OGP_ORIGINS, true)) ogp_fail('このページからは使えません', 403);
	ogp_rate_limit();
}

// 調べる URL を受け取る（http(s):// がなければ https:// を付ける）
function ogp_input_url(): string
{
	$url = trim((string)($_GET['url'] ?? ''));
	if ($url === '') ogp_fail('URL を入れてください');
	if (preg_match('#^([a-z][a-z0-9+.-]*):#i', $url, $m) && ! preg_match('#^https?://#i', $url) && strpos($m[1], '.') === false) {
		if (! preg_match('#^[\w.-]+:\d+#', $url)) ogp_fail('http か https の URL だけ調べられます');
	}
	if (! preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
	return $url;
}

// ---- 短い時間に何度も呼ばれないように（IP ごとに、最近呼ばれた時刻を覚えておく）

function ogp_rate_limit(): void
{
	$dir = sys_get_temp_dir() . '/donnma-ogp-rate';
	if (! is_dir($dir)) @mkdir($dir, 0700, true);
	$ip = $_SERVER['REMOTE_ADDR'] ?? '';
	$file = $dir . '/' . md5($ip) . '.json';
	$now = time();
	$fp = @fopen($file, 'c+');
	if (! $fp) return;
	flock($fp, LOCK_EX);
	$list = json_decode((string)stream_get_contents($fp), true);
	$list = array_values(array_filter(is_array($list) ? $list : [], fn($t) => is_int($t) && $t > $now - OGP_RATE_WINDOW));
	if (count($list) >= OGP_RATE_COUNT) {
		flock($fp, LOCK_UN); fclose($fp);
		ogp_fail('短い時間に続けて使われたので、少し待ってからもう一度ためしてください', 429);
	}
	$list[] = $now;
	ftruncate($fp, 0); rewind($fp);
	fwrite($fp, json_encode($list));
	flock($fp, LOCK_UN); fclose($fp);
	// たまに古いファイルを片付ける
	if (mt_rand(1, 100) === 1) {
		foreach (glob($dir . '/*.json') ?: [] as $f) if (filemtime($f) < $now - OGP_RATE_WINDOW) @unlink($f);
	}
}

// ---- 安全に取りに行く

// URL を確かめて、つなぐ先の IP を決める。だめなら理由を返す
function ogp_check_url(string $url, ?array &$target, ?string &$why): bool
{
	$p = parse_url($url);
	if (! $p || ! isset($p['scheme'], $p['host'])) { $why = 'URL の形がおかしいです'; return false; }
	$scheme = strtolower($p['scheme']);
	if ($scheme !== 'http' && $scheme !== 'https') { $why = 'http か https の URL だけ調べられます'; return false; }
	$port = $p['port'] ?? ($scheme === 'https' ? 443 : 80);
	if ($port !== 80 && $port !== 443) { $why = 'ふつうのポート（80・443）の URL だけ調べられます'; return false; }
	if (isset($p['user']) || isset($p['pass'])) { $why = 'ユーザー名・パスワード入りの URL は調べられません'; return false; }
	$host = strtolower(trim($p['host'], '[]'));
	if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
		$why = 'このアドレスは調べられません'; return false;
	}
	if (filter_var($host, FILTER_VALIDATE_IP)) {
		$ips = [$host];
	} else {
		$ips = [];
		foreach (@dns_get_record($host, DNS_A | DNS_AAAA) ?: [] as $r) {
			if (isset($r['ip'])) $ips[] = $r['ip'];
			if (isset($r['ipv6'])) $ips[] = $r['ipv6'];
		}
		if (! $ips) { $why = 'このドメインが見つかりません（' . $host . '）'; return false; }
	}
	foreach ($ips as $ip) {
		if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
			$why = 'このアドレスは調べられません'; return false;
		}
	}
	$target = ['host' => $host, 'port' => $port, 'ip' => $ips[0], 'scheme' => $scheme];
	return true;
}

// 1回分の通信。転送（3xx）はたどらずに、そのまま返す
function ogp_fetch_once(string $url, array $t, string $ua, int $max, bool $wantBody = true): array
{
	$body = ''; $over = false; $headers = [];
	$ch = curl_init($url);
	$ip = strpos($t['ip'], ':') !== false ? '[' . $t['ip'] . ']' : $t['ip'];
	curl_setopt_array($ch, [
		CURLOPT_RESOLVE        => [$t['host'] . ':' . $t['port'] . ':' . $ip],
		CURLOPT_FOLLOWLOCATION => false,
		CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
		CURLOPT_CONNECTTIMEOUT => 5,
		CURLOPT_TIMEOUT        => OGP_TIMEOUT,
		CURLOPT_USERAGENT      => $ua,
		CURLOPT_ENCODING       => '',  // gzip・br などを受け取って、ほどく
		CURLOPT_HTTPHEADER     => ['Accept: text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8', 'Accept-Language: ja,en;q=0.8'],
		CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$headers) {
			$len = strlen($line);
			if (preg_match('/^HTTP\//', $line)) $headers = [];
			elseif (strpos($line, ':') !== false) {
				[$k, $v] = explode(':', $line, 2);
				$k = strtolower(trim($k));
				// 同じ名前が何回も来たら（Link など）、つなげて持つ
				$headers[$k] = isset($headers[$k]) ? $headers[$k] . ', ' . trim($v) : trim($v);
			}
			return $len;
		},
		CURLOPT_WRITEFUNCTION  => function ($ch, $chunk) use (&$body, &$over, $max, $wantBody) {
			if (! $wantBody) return -1;
			$body .= $chunk;
			if (strlen($body) > $max) { $over = true; return -1; }
			return strlen($chunk);
		},
	]);
	curl_exec($ch);
	$err = curl_errno($ch);
	$info = curl_getinfo($ch);
	$errMsg = curl_error($ch);
	curl_close($ch);
	// 読む量を超えて止めたとき・画像の大きさだけ見たくて止めたときは、失敗あつかいにしない
	if ($err && ! $over && ! (! $wantBody && $err === CURLE_WRITE_ERROR)) {
		return ['error' => $err === CURLE_OPERATION_TIMEDOUT ? '時間内に返事がありませんでした（' . OGP_TIMEOUT . '秒）' : 'つながりませんでした（' . $errMsg . '）'];
	}
	return [
		'status'  => (int)$info['http_code'],
		'headers' => $headers,
		'body'    => $body,
		'over'    => $over,
		'time'    => round((float)$info['total_time'], 3),
		'ttfb'    => round((float)$info['starttransfer_time'], 3),
		'size'    => (int)$info['size_download'],
		'ip'      => $t['ip'],
	];
}

// 転送をたどりながら取る（転送先も毎回確かめる）
function ogp_fetch(string $url, string $ua, int $max, array &$chain): array
{
	for ($i = 0; $i <= OGP_MAX_REDIRECTS; $i++) {
		if (! ogp_check_url($url, $t, $why)) return ['error' => $why, 'url' => $url];
		$r = ogp_fetch_once($url, $t, $ua, $max);
		if (isset($r['error'])) return $r + ['url' => $url];
		$chain[] = ['url' => $url, 'status' => $r['status']];
		if ($r['status'] >= 300 && $r['status'] < 400 && isset($r['headers']['location'])) {
			$url = ogp_abs($r['headers']['location'], $url);
			continue;
		}
		return $r + ['url' => $url];
	}
	return ['error' => '転送が多すぎます（' . OGP_MAX_REDIRECTS . '回より多い）', 'url' => $url];
}

// 相対 URL を絶対 URL に
function ogp_abs(string $rel, string $base): string
{
	$rel = trim(html_entity_decode($rel, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
	if ($rel === '') return $base;
	if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $rel)) return $rel;
	$b = parse_url($base);
	$origin = $b['scheme'] . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
	if (str_starts_with($rel, '//')) return $b['scheme'] . ':' . $rel;
	if ($rel[0] === '/') return $origin . $rel;
	if ($rel[0] === '?') return $origin . ($b['path'] ?? '/') . $rel;
	if ($rel[0] === '#') return $base;
	$dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/');
	$path = $dir . $rel;
	// ./ と ../ をたたむ
	$out = [];
	foreach (explode('/', $path) as $seg) {
		if ($seg === '..') array_pop($out);
		elseif ($seg !== '.') $out[] = $seg;
	}
	return $origin . implode('/', $out);
}

// User-agent ごとの [Allow/Disallow, パス] の一覧にする
function ogp_robots_parse(string $txt): array
{
	$groups = []; $agents = []; $inRules = false;
	foreach (preg_split('/\R/', $txt) as $line) {
		$line = trim(preg_replace('/#.*/', '', $line));
		if (! preg_match('/^([\w-]+)\s*:\s*(.*)$/', $line, $m)) continue;
		$k = strtolower($m[1]); $v = trim($m[2]);
		if ($k === 'user-agent') {
			if ($inRules) { $agents = []; $inRules = false; }
			$agents[] = strtolower($v);
			foreach ($agents as $a) $groups[$a] = $groups[$a] ?? [];
		} elseif ($k === 'allow' || $k === 'disallow') {
			$inRules = true;
			foreach ($agents as $a) $groups[$a][] = [$k === 'allow', $v];
		}
	}
	return $groups;
}

// いちばん長く当てはまるルールに従う（同じ長さなら Allow）。名前の合う組がなければ * の組
function ogp_robots_allowed(array $groups, string $bot, string $path): bool
{
	$rules = null;
	foreach ($groups as $a => $r) if ($a !== '*' && $a !== '' && strpos($bot, $a) !== false) { $rules = $r; break; }
	$rules = $rules ?? ($groups['*'] ?? []);
	$best = -1; $allow = true;
	foreach ($rules as [$isAllow, $pat]) {
		if ($pat === '') continue;
		$re = '#^' . str_replace(['\*', '\$'], ['.*', '$'], preg_quote($pat, '#')) . '#';
		if (! preg_match($re, $path)) continue;
		$len = strlen($pat);
		if ($len > $best || ($len === $best && $isAllow)) { $best = $len; $allow = $isAllow; }
	}
	return $allow;
}

resource "cloudflare_dns_record" "frontend" {
  zone_id = var.zone_id
  name    = var.frontend_hostname == var.zone_name ? "@" : trimsuffix(replace(var.frontend_hostname, ".${var.zone_name}", ""), ".")
  type    = "CNAME"
  content = var.frontend_origin
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "api" {
  zone_id = var.zone_id
  name    = trimsuffix(replace(var.api_hostname, ".${var.zone_name}", ""), ".")
  type    = "CNAME"
  content = var.api_origin
  ttl     = 1
  proxied = true
}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = var.zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "automatic_https_rewrites" {
  zone_id    = var.zone_id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = var.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "cloudflare_zone_setting" "ssl" {
  zone_id    = var.zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "security_level" {
  zone_id    = var.zone_id
  setting_id = "security_level"
  value      = "high"
}

resource "cloudflare_zone_setting" "browser_check" {
  zone_id    = var.zone_id
  setting_id = "browser_check"
  value      = "on"
}

resource "cloudflare_zone_setting" "browser_cache_ttl" {
  zone_id    = var.zone_id
  setting_id = "browser_cache_ttl"
  value      = 14400
}

resource "cloudflare_zone_setting" "bot_fight_mode" {
  count      = var.enable_bot_fight_mode ? 1 : 0
  zone_id    = var.zone_id
  setting_id = "bot_fight_mode"
  value      = "on"
}

resource "cloudflare_zone_settings_override" "security_headers" {
  zone_id = var.zone_id

  settings {
    security_header {
      enabled            = true
      include_subdomains = true
      max_age            = 31536000
      nosniff            = true
      preload            = true
    }
  }
}

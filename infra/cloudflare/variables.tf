variable "cloudflare_api_token" {
  description = "Cloudflare API token with zone DNS and zone settings permissions."
  type        = string
  sensitive   = true
}

variable "zone_id" {
  description = "Cloudflare zone identifier."
  type        = string
}

variable "zone_name" {
  description = "Primary DNS zone, for example chengeto.health."
  type        = string
}

variable "frontend_hostname" {
  description = "Public frontend hostname."
  type        = string
  default     = "chengeto.health"
}

variable "api_hostname" {
  description = "Public API hostname."
  type        = string
  default     = "api.chengeto.health"
}

variable "frontend_origin" {
  description = "Render frontend origin CNAME target."
  type        = string
}

variable "api_origin" {
  description = "Render backend origin CNAME target."
  type        = string
}

variable "enable_bot_fight_mode" {
  description = "Enable bot fight mode if the plan supports it."
  type        = bool
  default     = false
}

{{/*
Expand the name of the chart.
*/}}
{{- define "puppy-store.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "puppy-store.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "puppy-store.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "puppy-store.labels" -}}
helm.sh/chart: {{ include "puppy-store.chart" . }}
{{ include "puppy-store.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "puppy-store.selectorLabels" -}}
app.kubernetes.io/name: {{ include "puppy-store.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database URL construction
*/}}
{{- define "puppy-store.databaseUrl" -}}
{{- if .Values.database.external }}
{{- printf "postgresql://%s:$(DATABASE_PASSWORD)@%s:%v/%s?schema=public&sslmode=require" .Values.database.user .Values.database.host (.Values.database.port | int) .Values.database.name }}
{{- else }}
{{- printf "postgresql://postgres:$(DATABASE_PASSWORD)@%s-postgresql:%v/%s?schema=public" .Release.Name (.Values.database.port | int) .Values.database.name }}
{{- end }}
{{- end }}

{{/*
Redis host - returns external host or internal service name
*/}}
{{- define "puppy-store.redisHost" -}}
{{- if and .Values.redis.external .Values.redis.external.enabled }}
{{- .Values.redis.external.host }}
{{- else }}
{{- printf "%s-redis" (include "puppy-store.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Redis port - returns external port or internal service port
*/}}
{{- define "puppy-store.redisPort" -}}
{{- if and .Values.redis.external .Values.redis.external.enabled }}
{{- .Values.redis.external.port }}
{{- else }}
{{- .Values.redis.service.port }}
{{- end }}
{{- end }}

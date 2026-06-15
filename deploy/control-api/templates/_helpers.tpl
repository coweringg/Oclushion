{{- define "control-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "control-api.fullname" -}}
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

{{- define "control-api.labels" -}}
helm.sh/chart: {{ include "control-api.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "control-api.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "control-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "control-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "control-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "control-api.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- .Values.serviceAccount.name }}
{{- end }}
{{- end }}

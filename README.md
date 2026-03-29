# Areya RRHH — Sistema Interno

Sistema digital de Recursos Humanos para Areya Industrial.

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Hosting**: Vercel

## Rutas
| Ruta | Descripción |
|------|-------------|
| `/` | Formulario de ingreso (público) |
| `/portal` | Portal de onboarding (empleados) |
| `/salida` | Entrevista de salida |
| `/admin` | Panel admin RRHH (protegido) |

## Setup local

```bash
# 1. Clonar el repo
git clone https://github.com/TU_USUARIO/areya-rrhh.git
cd areya-rrhh

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env (ya incluido con credenciales)
# Si no existe, crear .env con:
# VITE_SUPABASE_URL=https://isbccvictvynusjisowp.supabase.co
# VITE_SUPABASE_ANON_KEY=tu_anon_key

# 4. Correr en desarrollo
npm run dev

# 5. Build para producción
npm run build
```

## Deploy en Vercel
1. Conectar repo de GitHub en vercel.com
2. Framework: Vite
3. Agregar variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automático en cada push a main

## Base de datos
Ejecutar `supabase_schema_v2.sql` en Supabase → SQL Editor antes del primer uso.

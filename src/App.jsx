import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Formulario from './pages/Formulario'
import Portal from './pages/Portal'
import Salida from './pages/Salida'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Formulario público de ingreso — ruta raíz */}
        <Route path="/" element={<Formulario />} />

        {/* Portal del empleado */}
        <Route path="/portal" element={<Portal />} />

        {/* Entrevista de salida */}
        <Route path="/salida" element={<Salida />} />

        {/* Panel admin RRHH */}
        <Route path="/admin" element={<Admin />} />

        {/* Redirigir rutas desconocidas al formulario */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

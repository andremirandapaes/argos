import { Navigate, Route, Routes } from 'react-router-dom'
import { ExigePapel, RotaProtegida } from '@/auth/RotaProtegida'
import { AppLayout } from '@/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { MODULOS, ROTA_INICIAL } from '@/modulos'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RotaProtegida>
            <AppLayout />
          </RotaProtegida>
        }
      >
        <Route index element={<Navigate to={ROTA_INICIAL} replace />} />
        {MODULOS.map((modulo) => (
          <Route key={modulo.id} path={modulo.id}>
            <Route index element={<Navigate to={modulo.telaInicial} replace />} />
            {modulo.telas.map((tela) => (
              <Route
                key={tela.caminho}
                path={`${tela.caminho}/*`}
                element={
                  <ExigePapel minimo={tela.papelMinimo}>
                    {tela.elemento}
                  </ExigePapel>
                }
              />
            ))}
          </Route>
        ))}
        <Route path="*" element={<Navigate to={ROTA_INICIAL} replace />} />
      </Route>
    </Routes>
  )
}

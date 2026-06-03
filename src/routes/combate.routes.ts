import { Router } from 'express';
import { CombateController } from '../controllers/combate.controller';

const router = Router();
const combateController = new CombateController();

// Creación de combate
router.post('/buscar-usuarios', combateController.buscarUsuarios.bind(combateController));
router.post('/invitar', combateController.invitarUsuario.bind(combateController));
router.post('/buscar', combateController.buscarOponente.bind(combateController));

// Gestión de combates
router.put('/:id/aceptar', combateController.aceptarCombate.bind(combateController));
router.put('/:id/abandonar', combateController.abandonarCombate.bind(combateController));
router.delete('/:id/cancelar-busqueda', combateController.cancelarBusqueda.bind(combateController));
router.delete('/:id/rechazar', combateController.rechazarCombate.bind(combateController));
router.get('/usuario/:idUsuario', combateController.obtenerCombatesUsuario.bind(combateController));
router.get('/:id', combateController.obtenerDetalleCombate.bind(combateController));

// Rondas y Turnos
router.post('/ronda', combateController.crearRonda.bind(combateController));
router.post('/turno', combateController.registrarTurno.bind(combateController));

export default router;

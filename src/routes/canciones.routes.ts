import { Router } from 'express';
import { CancionesController } from '../controllers/canciones.controller';

const router = Router();
const cancionesController = new CancionesController();

router.get('/', cancionesController.obtenerCanciones.bind(cancionesController));
router.get('/admin/listado', cancionesController.obtenerCancionesAdmin.bind(cancionesController));
router.get('/:id', cancionesController.obtenerCancionPorId.bind(cancionesController));

router.post('/', cancionesController.crearCancion.bind(cancionesController));
router.put('/:id', cancionesController.actualizarCancion.bind(cancionesController));
router.patch('/:id/activa', cancionesController.toggleActiva.bind(cancionesController));
router.delete('/:id', cancionesController.eliminarCancion.bind(cancionesController));

export default router;
import { Request, Response } from 'express';
import { CancionesService } from '../services/canciones.service';

const cancionesService = new CancionesService();

export class CancionesController {

  async obtenerCanciones(req: Request, res: Response) {
    try {
      const canciones = await cancionesService.obtenerCanciones();

      return res.status(200).json({
        ok: true,
        data: canciones
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al obtener canciones'
      });
    }
  }

  async obtenerCancionPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          ok: false,
          message: 'El id de la canción no es válido'
        });
      }

      const cancion = await cancionesService.obtenerCancionPorId(id);

      return res.status(200).json({
        ok: true,
        data: cancion
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al obtener canción'
      });
    }
  }

  async obtenerCancionesAdmin(req: Request, res: Response) {
    try {
      const canciones = await cancionesService.obtenerCancionesAdmin();

      return res.status(200).json({
        ok: true,
        data: canciones
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al obtener canciones para administración'
      });
    }
  }

  async crearCancion(req: Request, res: Response) {
    try {
      const cancionCreada = await cancionesService.crearCancion(req.body);

      return res.status(201).json({
        ok: true,
        data: cancionCreada
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al crear canción'
      });
    }
  }

  async actualizarCancion(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          ok: false,
          message: 'El id de la canción no es válido'
        });
      }

      const cancionActualizada = await cancionesService.actualizarCancion(id, req.body);

      return res.status(200).json({
        ok: true,
        data: cancionActualizada
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al actualizar canción'
      });
    }
  }

  async toggleActiva(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ ok: false, message: 'El id de la canción no es válido' });
      }
      const { activa } = req.body;
      if (typeof activa !== 'boolean') {
        return res.status(400).json({ ok: false, message: 'El campo activa debe ser true o false' });
      }
      const cancion = await cancionesService.toggleActiva(id, activa);
      return res.status(200).json({ ok: true, data: cancion });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al cambiar estado de la canción'
      });
    }
  }

  async eliminarCancion(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          ok: false,
          message: 'El id de la canción no es válido'
        });
      }

      const resultado = await cancionesService.eliminarCancion(id);

      return res.status(200).json({
        ok: true,
        data: resultado
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al eliminar canción'
      });
    }
  }
}
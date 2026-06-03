import { Request, Response } from 'express';
import { CombateService } from '../services/combate.service';

const combateService = new CombateService();

export class CombateController {

  async buscarUsuarios(req: Request, res: Response) {
    try {
      const { query, idExcluido } = req.body;
      const usuarios = await combateService.buscarUsuarios(query, idExcluido);
      return res.status(200).json({ ok: true, data: usuarios });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al buscar usuarios'
      });
    }
  }

  async invitarUsuario(req: Request, res: Response) {
    try {
      const { idJugador1, idJugador2 } = req.body;
      const combate = await combateService.invitarUsuario(idJugador1, idJugador2);
      return res.status(201).json({ ok: true, data: combate });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al enviar invitación'
      });
    }
  }

  async buscarOponente(req: Request, res: Response) {
    try {
      const { idJugador1, idNivel } = req.body;
      const resultado = await combateService.buscarOponente(idJugador1, idNivel);
      return res.status(200).json({ ok: true, data: resultado });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al buscar oponente'
      });
    }
  }

  async aceptarCombate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const combate = await combateService.aceptarCombate(id as string);
      return res.status(200).json({ ok: true, data: combate });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al aceptar combate'
      });
    }
  }

  async abandonarCombate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { idAbandonador } = req.body;
      if (!idAbandonador) {
        return res.status(400).json({ ok: false, message: 'Falta el id del jugador que abandona.' });
      }
      const combate = await combateService.abandonarCombate(id as string, String(idAbandonador));
      return res.status(200).json({ ok: true, data: combate });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al registrar abandono'
      });
    }
  }

  async cancelarBusqueda(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await combateService.cancelarBusqueda(id as string);
      return res.status(200).json({ ok: true, message: 'Búsqueda cancelada' });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al cancelar búsqueda'
      });
    }
  }

  async rechazarCombate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await combateService.rechazarCombate(id as string);
      return res.status(200).json({ ok: true, message: 'Invitación rechazada' });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al rechazar combate'
      });
    }
  }

  async crearRonda(req: Request, res: Response) {
    try {
      const { idCombate, numeroRonda, idCancion, idSelector } = req.body;
      const ronda = await combateService.crearRonda(idCombate, numeroRonda, idCancion, idSelector);
      return res.status(201).json({ ok: true, data: ronda });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al crear ronda'
      });
    }
  }

  async registrarTurno(req: Request, res: Response) {
    try {
      const { idRonda, idUsuario, puntaje, urlAudio, feedback, transcripcion } = req.body;
      const turno = await combateService.registrarTurno(idRonda, idUsuario, puntaje, urlAudio, feedback, transcripcion);
      return res.status(201).json({ ok: true, data: turno });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al registrar turno'
      });
    }
  }

  async obtenerCombatesUsuario(req: Request, res: Response) {
    try {

      const { idUsuario } = req.params;
      const combates = await combateService.obtenerCombatesUsuario(idUsuario as string);

      return res.status(200).json({ ok: true, data: combates });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al obtener combates'
      });
    }
  }

  async obtenerDetalleCombate(req: Request, res: Response) {
    try {

      const { id } = req.params;
      const combate = await combateService.obtenerDetalleCombate(id as string);

      return res.status(200).json({ ok: true, data: combate });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Error al obtener detalle de combate'
      });
    }
  }
}

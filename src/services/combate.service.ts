import { supabase } from '../config/supabase';
import { ESTADO_COMBATE, ESTADO_RONDA } from '../constants/estados';

export class CombateService {

  // 0. Buscar usuarios para invitar (Autocompletado)
  async buscarUsuarios(query: string, idExcluido: string) {
    const { data, error } = await supabase
      .from('tbl_usuario')
      .select('id, nombre, apellido, id_nivel, auth_uid')
      .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
      .neq('id', idExcluido)
      .limit(10);

    if (error) throw new Error(error.message);
    return data;
  }

  // 1. Crear invitación manual
  async invitarUsuario(idJugador1: string, idJugador2: string) {
    const { data, error } = await supabase
      .from('tbl_combate')
      .insert({
        id_usuario_jugador1: idJugador1,
        id_usuario_jugador2: idJugador2,
        id_estado: ESTADO_COMBATE.PENDIENTE
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // 2. Buscar oponente automáticamente (Matchmaking)
  async buscarOponente(idJugador1: string, idNivel: string) {
    // Normalizar nivel: null o 0 → 1 (Principiante), igual que hace el frontend
    const nivelBuscado = Number(idNivel) || 1;

    // PASO 1: traer todos los combates en espera (sin join — más fiable)
    const { data: enEspera, error: errEspera } = await supabase
      .from('tbl_combate')
      .select('id, id_usuario_jugador1')
      .eq('id_estado', ESTADO_COMBATE.EN_CURSO)
      .is('id_usuario_jugador2', null)
      .neq('id_usuario_jugador1', idJugador1);

    if (errEspera) throw new Error(errEspera.message);

    console.log(`[Matchmaking] Jugador ${idJugador1} (nivel ${nivelBuscado}). Combates en espera: ${enEspera.length}`);

    let combateElegido: any = null;

    if (enEspera.length > 0) {
      // TODO: filtro por nivel temporalmente desactivado para la entrega.
      // Actualmente empareja con cualquier jugador disponible sin importar el nivel.
      // Reactivar cuando se resuelva el problema de lectura de niveles desde Supabase.

      /* --- FILTRO POR NIVEL (descomentar cuando esté listo) ---
      const idsJugadores = enEspera.map((c: any) => c.id_usuario_jugador1);
      const { data: usuarios, error: errUsuarios } = await supabase
        .from('tbl_usuario').select('id, id_nivel').in('id', idsJugadores);
      if (errUsuarios) throw new Error(errUsuarios.message);
      const nivelPorUsuario: Record<string, number> = {};
      for (const u of (usuarios ?? [])) {
        nivelPorUsuario[String(u.id)] = Number(u.id_nivel) || 1;
      }
      const posibles = enEspera.filter((c: any) => {
        const nivelOponente = nivelPorUsuario[String(c.id_usuario_jugador1)] ?? 1;
        return nivelOponente === nivelBuscado;
      });
      if (posibles.length > 0) {
        combateElegido = posibles[Math.floor(Math.random() * posibles.length)];
      }
      --- FIN FILTRO POR NIVEL --- */

      // Empareja con cualquier jugador en espera (aleatorio)
      combateElegido = enEspera[Math.floor(Math.random() * enEspera.length)];
    }

    if (combateElegido) {
      // Unirse al combate existente
      const { data, error } = await supabase
        .from('tbl_combate')
        .update({ id_usuario_jugador2: idJugador1 })
        .eq('id', combateElegido.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      console.log(`[Matchmaking] Match encontrado → combate ${combateElegido.id}`);
      return { status: 'match_found', combate: data };
    }

    // Ningún oponente del mismo nivel disponible → entrar en cola de espera
    const { data, error } = await supabase
      .from('tbl_combate')
      .insert({ id_usuario_jugador1: idJugador1, id_estado: ESTADO_COMBATE.EN_CURSO })
      .select()
      .single();

    if (error) throw new Error(error.message);
    console.log(`[Matchmaking] Sin rival → creando combate en espera ${data.id}`);
    return { status: 'waiting', combate: data };
  }

  // 3. Aceptar Combate (Invitación manual)
  async aceptarCombate(idCombate: string) {
    const { data, error } = await supabase
      .from('tbl_combate')
      .update({ id_estado: ESTADO_COMBATE.EN_CURSO })
      .eq('id', idCombate)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // 3b. Abandonar combate — el que abandona pierde, el otro gana automáticamente
  async abandonarCombate(idCombate: string, idAbandonador: string) {
    // Traer el combate para saber quién es el oponente
    const { data: combate, error } = await supabase
      .from('tbl_combate')
      .select('id, id_usuario_jugador1, id_usuario_jugador2, id_estado')
      .eq('id', idCombate)
      .single();

    if (error || !combate) throw new Error('Combate no encontrado.');
    if (combate.id_estado === ESTADO_COMBATE.FINALIZADO) throw new Error('Este combate ya terminó.');

    // El ganador es el que NO abandonó
    const idGanador =
      String(combate.id_usuario_jugador1) === String(idAbandonador)
        ? combate.id_usuario_jugador2
        : combate.id_usuario_jugador1;

    if (!idGanador) throw new Error('No hay oponente registrado en este combate.');

    const { data: actualizado, error: errUpdate } = await supabase
      .from('tbl_combate')
      .update({
        id_usuario_ganador: idGanador,
        id_estado: ESTADO_COMBATE.FINALIZADO
      })
      .eq('id', idCombate)
      .select()
      .single();

    if (errUpdate) throw new Error(errUpdate.message);
    return actualizado;
  }

  // 3c. Cancelar búsqueda de matchmaking
  async cancelarBusqueda(idCombate: string) {
    // Solo se puede cancelar si todavía no hay jugador2 (aún en cola de espera)
    // Esto evita cancelar accidentalmente un combate que ya empezó
    const { error } = await supabase
      .from('tbl_combate')
      .delete()
      .eq('id', idCombate)
      .eq('id_estado', ESTADO_COMBATE.EN_CURSO)
      .is('id_usuario_jugador2', null);

    if (error) throw new Error(error.message);
    return { ok: true };
  }

  // 3c. Rechazar Combate (Elimina la invitación pendiente)
  async rechazarCombate(idCombate: string) {
    const { error } = await supabase
      .from('tbl_combate')
      .delete()
      .eq('id', idCombate)
      .eq('id_estado', ESTADO_COMBATE.PENDIENTE);

    if (error) throw new Error(error.message);
    return { ok: true };
  }

  // 4. Crear Ronda (El selector elige la canción)
  async crearRonda(idCombate: string, numeroRonda: number, idCancion: string, idSelector: string) {
    // La ronda 3 (desempate) la crea el sistema automáticamente — nunca manualmente
    if (numeroRonda >= 3) throw new Error('La ronda de desempate la elige el sistema automáticamente.');

    // Evitar rondas duplicadas: verificar que no exista ya esa ronda en este combate
    const { data: rondaExistente } = await supabase
      .from('tbl_rondas')
      .select('id')
      .eq('id_combate', idCombate)
      .eq('numero_ronda', numeroRonda)
      .maybeSingle();

    if (rondaExistente) throw new Error('Esta ronda ya fue creada.');

    // Verificar que el selector sea el jugador correcto para este número de ronda
    const { data: combate } = await supabase
      .from('tbl_combate')
      .select('id_usuario_jugador1, id_usuario_jugador2')
      .eq('id', idCombate)
      .single();

    if (!combate) throw new Error('Combate no encontrado.');

    const selectorEsperado = numeroRonda === 1
      ? combate.id_usuario_jugador1
      : combate.id_usuario_jugador2;

    // Comparamos como string porque los IDs pueden llegar en distintos tipos
    if (String(idSelector) !== String(selectorEsperado)) {
      throw new Error('No es tu turno de elegir la canción para esta ronda.');
    }

    const { data, error } = await supabase
      .from('tbl_rondas')
      .insert({
        id_combate: idCombate,
        numero_ronda: numeroRonda,
        id_cancion: idCancion,
        id_usuario_selector: idSelector,
        id_estado: ESTADO_RONDA.PENDIENTE
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // 5. Registrar Turno
  async registrarTurno(idRonda: string, idUsuario: string, puntaje: number, urlAudio: string, feedback: any, transcripcion: string) {
    // Evitar que un jugador cante dos veces en la misma ronda
    const { data: turnoExistente } = await supabase
      .from('tbl_turnos')
      .select('id')
      .eq('id_rondas', idRonda)
      .eq('id_usuario', idUsuario)
      .maybeSingle();

    if (turnoExistente) throw new Error('Ya registraste tu turno en esta ronda.');

    // Verificar que la ronda esté en estado pendiente (no cerrada)
    const { data: ronda } = await supabase
      .from('tbl_rondas')
      .select('id_estado')
      .eq('id', idRonda)
      .single();

    if (!ronda || ronda.id_estado !== ESTADO_RONDA.PENDIENTE) throw new Error('Esta ronda ya está cerrada.');

    const { data, error } = await supabase
      .from('tbl_turnos')
      .insert({
        id_rondas: idRonda,
        id_usuario: idUsuario,
        puntaje: puntaje,
        url_audio_usuario: urlAudio,
        feedback: feedback,
        transcripcion: transcripcion,
        id_estado: 2 // completado
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Revisar si ya están los dos turnos para declarar ganador de la ronda
    await this.evaluarRonda(idRonda);

    return data;
  }

  private async evaluarRonda(idRonda: string) {
    // Traer todos los turnos de la ronda
    const { data: turnos, error } = await supabase
      .from('tbl_turnos')
      .select('*')
      .eq('id_rondas', idRonda);

    if (error) throw new Error(error.message);

    // Esperar a que ambos jugadores hayan cantado
    if (turnos.length < 2) return;

    // Determinar ganador comparando puntajes
    // Si hay empate exacto, id_usuario_ganador queda null (ronda empatada)
    let idGanadorRonda: string | null = null;
    if (turnos[0].puntaje > turnos[1].puntaje) {
      idGanadorRonda = turnos[0].id_usuario;
    } else if (turnos[1].puntaje > turnos[0].puntaje) {
      idGanadorRonda = turnos[1].id_usuario;
    }
    // Si son iguales, idGanadorRonda sigue null → ronda empatada

    // Actualizar ronda con resultado
    const { data: rondaActualizada, error: errRonda } = await supabase
      .from('tbl_rondas')
      .update({
        id_usuario_ganador: idGanadorRonda,
        id_estado: ESTADO_RONDA.CERRADA
      })
      .eq('id', idRonda)
      .select()
      .single();

    if (errRonda) throw new Error(errRonda.message);

    // Evaluar si ya hay ganador del combate
    await this.evaluarCombate(rondaActualizada.id_combate);
  }

  private async evaluarCombate(idCombate: string) {
    // Traer TODAS las rondas cerradas (incluyendo las empatadas con ganador null)
    const { data: rondas, error } = await supabase
      .from('tbl_rondas')
      .select('*')
      .eq('id_combate', idCombate)
      .eq('id_estado', ESTADO_RONDA.CERRADA);

    if (error) throw new Error(error.message);

    // Contar victorias (ignorar rondas empatadas donde ganador es null)
    const victorias: Record<string, number> = {};
    for (const r of rondas) {
      if (r.id_usuario_ganador) {
        victorias[r.id_usuario_ganador] = (victorias[r.id_usuario_ganador] || 0) + 1;
      }
    }

    let ganadorCombate: string | null = null;

    // Caso 1: alguien ya tiene 2 victorias (ganó las dos primeras rondas)
    for (const [idUsuario, count] of Object.entries(victorias)) {
      if (count >= 2) {
        ganadorCombate = idUsuario;
      }
    }

    // Caso 2: se completaron las 2 rondas y nadie tiene 2 victorias todavía
    if (!ganadorCombate && rondas.length === 2) {
      // Contar victorias de cada jugador para ver si hay ventaja
      const counts = Object.values(victorias);
      const maxVictorias = counts.length > 0 ? Math.max(...counts) : 0;
      const lideres = Object.keys(victorias).filter(id => victorias[id] === maxVictorias);

      if (lideres.length === 1) {
        // Un jugador tiene más victorias que el otro (ej. 1-0 con una ronda empatada)
        // → ese jugador gana el combate, no hace falta desempate
        ganadorCombate = lideres[0];
      }
      // Si lideres.length !== 1, hay empate real (1-1 o 0-0) → se crea ronda de desempate abajo
    }

    const hayDesempate = rondas.length === 2 && !ganadorCombate;

    if (ganadorCombate) {
      await supabase
        .from('tbl_combate')
        .update({
          id_usuario_ganador: ganadorCombate,
          id_estado: ESTADO_COMBATE.FINALIZADO
        })
        .eq('id', idCombate);
    } else if (hayDesempate) {
      await this.crearRondaDesempate(idCombate, rondas);
    }
  }

  private async crearRondaDesempate(idCombate: string, rondasPrevias: any[]) {
    const idsCancionesPrevias = rondasPrevias.map(r => r.id_cancion);

    // 1. Obtener los géneros de las canciones ya cantadas
    const { data: generosPrevios } = await supabase
      .from('tbl_genero_musical_x_cancion')
      .select('id_genero_musical')
      .in('id_cancion', idsCancionesPrevias);

    const idsGenerosPrevios = (generosPrevios || []).map(g => g.id_genero_musical);

    // 2. Obtener todas las canciones con sus géneros
    const { data: canciones, error } = await supabase
      .from('tbl_cancion')
      .select('id, tbl_genero_musical_x_cancion(id_genero_musical)');

    if (error || !canciones) return;

    // 3. Filtrar para no repetir canciones
    let cancionesDisponibles = canciones.filter(c => !idsCancionesPrevias.includes(c.id));
    
    // 4. Intentar filtrar canciones que tengan géneros DISTINTOS a los previos
    const cancionesConGeneroDiferente = cancionesDisponibles.filter(c => {
      // array de generos de esta cancion
      const generos = c.tbl_genero_musical_x_cancion.map((g: any) => g.id_genero_musical);
      // Queremos que no haya intersección con los géneros previos
      return !generos.some((g: any) => idsGenerosPrevios.includes(g));
    });

    // Si hay canciones de otros géneros, usamos esas. Si no, hacemos fallback a todas las disponibles.
    if (cancionesConGeneroDiferente.length > 0) {
      cancionesDisponibles = cancionesConGeneroDiferente;
    }

    if (cancionesDisponibles.length > 0) {
      // Seleccionar una al azar
      const seleccionada = cancionesDisponibles[Math.floor(Math.random() * cancionesDisponibles.length)];
      
      // Crear la ronda 3 de desempate
      await supabase
        .from('tbl_rondas')
        .insert({
          id_combate: idCombate,
          numero_ronda: 3,
          id_cancion: seleccionada.id,
          id_estado: ESTADO_RONDA.PENDIENTE
        });
    }
  }

  // 6. Obtener combates del usuario (historial e invitaciones)
  async obtenerCombatesUsuario(idUsuario: string) {
    const { data, error } = await supabase
      .from('tbl_combate')
      .select(`
        *,
        jugador1:tbl_usuario!id_usuario_jugador1(*),
        jugador2:tbl_usuario!id_usuario_jugador2(*)
      `)
      .or(`id_usuario_jugador1.eq.${idUsuario},id_usuario_jugador2.eq.${idUsuario}`)
      .order('fecha', { ascending: false }); // más recientes primero

    if (error) throw new Error(error.message);
    return data;
  }
  
  // 7. Obtener el detalle de un combate con sus rondas y turnos
  async obtenerDetalleCombate(idCombate: string) {
    const { data, error } = await supabase
      .from('tbl_combate')
      .select(`
        *,
        jugador1:tbl_usuario!id_usuario_jugador1(*),
        jugador2:tbl_usuario!id_usuario_jugador2(*),
        rondas:tbl_rondas(
          *,
          cancion:tbl_cancion(*),
          turnos:tbl_turnos(
            *,
            usuario:tbl_usuario(*)
          )
        )
      `)
      .eq('id', idCombate)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

import MovimentacaoEstoqueLoja from "../models/MovimentacaoEstoqueLoja.js";
import MovimentacaoEstoqueLojaProduto from "../models/MovimentacaoEstoqueLojaProduto.js";
import { Loja, Usuario, Produto } from "../models/index.js";

// Listar todas as movimentações de estoque de loja
  try {
    const movimentacoes = await MovimentacaoEstoqueLoja.findAll({
      order: [["dataMovimentacao", "DESC"]],
      include: [
        { model: Loja, attributes: ["id", "nome"] },
        { model: Usuario, attributes: ["id", "nome"] },
        {
          model: MovimentacaoEstoqueLojaProduto,
          as: "produtosEnviados",
          include: [{ model: Produto, as: "produto", attributes: ["id", "nome"] }],
        },
      ],
    });
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar movimentações" });
  }
};

// Criar nova movimentação
  try {
    const { lojaId, usuarioId, produtos, observacao, dataMovimentacao } = req.body;
    if (!lojaId || !usuarioId || !Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ error: "Dados obrigatórios faltando" });
    }
    const movimentacao = await MovimentacaoEstoqueLoja.create({
      lojaId,
      usuarioId,
      observacao,
      dataMovimentacao: dataMovimentacao || new Date(),
    });
    // Salvar produtos enviados
    for (const item of produtos) {
      await MovimentacaoEstoqueLojaProduto.create({
        movimentacaoEstoqueLojaId: movimentacao.id,
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      });
    }
    // Retornar movimentação com produtos
    const movimentacaoCompleta = await MovimentacaoEstoqueLoja.findByPk(movimentacao.id, {
      include: [
        { model: Loja, attributes: ["id", "nome"] },
        { model: Usuario, attributes: ["id", "nome"] },
        {
          model: MovimentacaoEstoqueLojaProduto,
          as: "produtosEnviados",
          include: [{ model: Produto, as: "produto", attributes: ["id", "nome"] }],
        },
      ],
    });
    res.status(201).json(movimentacaoCompleta);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar movimentação" });
  }
};

// Editar movimentação
  try {
    const { id } = req.params;
    const { lojaId, usuarioId, produtos, observacao, dataMovimentacao } = req.body;
    const movimentacao = await MovimentacaoEstoqueLoja.findByPk(id);
    if (!movimentacao) {
      return res.status(404).json({ error: "Movimentação não encontrada" });
    }
    movimentacao.lojaId = lojaId || movimentacao.lojaId;
    movimentacao.usuarioId = usuarioId || movimentacao.usuarioId;
    movimentacao.observacao = observacao || movimentacao.observacao;
    movimentacao.dataMovimentacao = dataMovimentacao || movimentacao.dataMovimentacao;
    movimentacao.atualizadoEm = new Date();
    await movimentacao.save();
    // Atualizar produtos enviados
    if (Array.isArray(produtos)) {
      await MovimentacaoEstoqueLojaProduto.destroy({ where: { movimentacaoEstoqueLojaId: movimentacao.id } });
      for (const item of produtos) {
        await MovimentacaoEstoqueLojaProduto.create({
          movimentacaoEstoqueLojaId: movimentacao.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
        });
      }
    }
    // Retornar movimentação com produtos
    const movimentacaoCompleta = await MovimentacaoEstoqueLoja.findByPk(movimentacao.id, {
      include: [
        { model: Loja, attributes: ["id", "nome"] },
        { model: Usuario, attributes: ["id", "nome"] },
        {
          model: MovimentacaoEstoqueLojaProduto,
          as: "produtosEnviados",
          include: [{ model: Produto, as: "produto", attributes: ["id", "nome"] }],
        },
      ],
    });
    res.json(movimentacaoCompleta);
  } catch (error) {
    res.status(500).json({ error: "Erro ao editar movimentação" });
  }
};

// Deletar movimentação
  try {
    const { id } = req.params;
    const movimentacao = await MovimentacaoEstoqueLoja.findByPk(id);
    if (!movimentacao) {
      return res.status(404).json({ error: "Movimentação não encontrada" });
    }
    await MovimentacaoEstoqueLojaProduto.destroy({ where: { movimentacaoEstoqueLojaId: movimentacao.id } });
    await movimentacao.destroy();
    res.json({ message: "Movimentação excluída com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir movimentação" });
  }
};

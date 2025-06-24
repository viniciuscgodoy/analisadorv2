import React, { useState, useCallback } from 'react';
import { Upload, BarChart3, TrendingUp, Filter, Calendar, Download, Users } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import _ from 'lodash';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import './App.css';

const AnimalWeightAnalyzer = () => {
  const [data, setData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [selectedPasto, setSelectedPasto] = useState('all');
  const [selectedIdade, setSelectedIdade] = useState('all');
  const [selectedSexo, setSelectedSexo] = useState('all'); // NOVA FUNCIONALIDADE
  const [loading, setLoading] = useState(false);

  // Definir faixas etárias para o filtro
  const faixasEtarias = [
    { value: 'all', label: 'Todas as idades', min: 0, max: Infinity },
    { value: '0-6', label: '0-6 meses (Bezerros)', min: 0, max: 6 },
    { value: '6-12', label: '6-12 meses (Desmama)', min: 6, max: 12 },
    { value: '12-18', label: '12-18 meses (Recria)', min: 12, max: 18 },
    { value: '18-24', label: '18-24 meses (Engorda)', min: 18, max: 24 },
    { value: '24+', label: '24+ meses (Adultos)', min: 24, max: Infinity }
  ];

  const processFile = useCallback((file) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let parsedData;
        
        if (file.name.endsWith('.csv')) {
          const csv = e.target.result;
          parsedData = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
          }).data;
        } else {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
        
        // Limpar headers (remover espaços)
        parsedData = parsedData.map(row => {
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toUpperCase();
            cleanRow[cleanKey] = row[key];
          });
          return cleanRow;
        });
        
        setData(parsedData);
        calculateWeightGain(parsedData);
      } catch (error) {
        alert('Erro ao processar arquivo: ' + error.message);
      }
      setLoading(false);
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    const dateString = dateStr.toString().trim();
    
    if (!isNaN(dateString) && dateString.length > 4) {
      const excelEpoch = new Date(1900, 0, 1);
      const jsDate = new Date(excelEpoch.getTime() + (parseInt(dateString) - 2) * 24 * 60 * 60 * 1000);
      return jsDate;
    }
    
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    ];
    
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const match = dateString.match(format);
      if (match) {
        let parsedDate;
        if (i === 1) {
          parsedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else {
          parsedDate = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        }
        return parsedDate;
      }
    }
    
    const date = new Date(dateString);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1990) {
      return date;
    }
    
    return null;
  };

  const calculateWeightGain = (rawData) => {
    try {
      const animalGroups = _.groupBy(rawData, row => {
        const animal = row.ANIMAL || row.animal || row.Animal;
        return animal ? animal.toString().trim() : 'UNKNOWN';
      });
      
      const results = [];
      
      Object.entries(animalGroups).forEach(([animalName, records]) => {
        if (records.length < 2) return;
        
        const sortedRecords = records
          .map(record => ({
            ...record,
            parsedDate: parseDate(record.DATA || record.DATA_PESAGEM || record.data_pesagem || record.Data_Pesagem)
          }))
          .filter(record => record.parsedDate && !isNaN(record.PESO || record.peso || record.Peso))
          .sort((a, b) => a.parsedDate - b.parsedDate);
        
        if (sortedRecords.length < 2) return;
        
        const gains = [];
        
        for (let i = 1; i < sortedRecords.length; i++) {
          const current = sortedRecords[i];
          const previous = sortedRecords[i - 1];
          
          const peso1 = previous.PESO || previous.peso || previous.Peso;
          const peso2 = current.PESO || current.peso || current.Peso;
          const days = (current.parsedDate - previous.parsedDate) / (1000 * 60 * 60 * 24);
          
          if (days > 0) {
            const weightGain = peso2 - peso1;
            const dailyGain = weightGain / days;
            gains.push(dailyGain);
          }
        }
        
        if (gains.length > 0) {
          const avgDailyGain = _.mean(gains);
          const lastRecord = sortedRecords[sortedRecords.length - 1];
          
          // Normalizar o sexo para garantir consistência
          const sexoRaw = lastRecord.SX || lastRecord.sx || lastRecord.Sx || lastRecord.SEXO || lastRecord.sexo || lastRecord.Sexo || 'N/A';
          const sexoNormalizado = sexoRaw.toString().toUpperCase().trim();
          
          results.push({
            animal: animalName,
            local: (lastRecord.LOCAL || lastRecord.local || lastRecord.Local || 'N/A').toString(),
            sexo: sexoNormalizado,
            meses: lastRecord.MESES || lastRecord.meses || lastRecord.Meses || 0,
            ganho_diario: parseFloat(avgDailyGain.toFixed(4)),
            total_pesagens: sortedRecords.length,
            peso_inicial: sortedRecords[0].PESO || sortedRecords[0].peso || sortedRecords[0].Peso,
            peso_final: lastRecord.PESO || lastRecord.peso || lastRecord.Peso,
          });
        }
      });
      
      setProcessedData(results);
    } catch (error) {
      alert('Erro ao calcular ganho de peso: ' + error.message);
    }
  };

  const getFilteredData = () => {
    if (!processedData) return [];
    
    let filtered = processedData;
    
    // Filtro por pasto
    if (selectedPasto !== 'all') {
      filtered = filtered.filter(item => item.local === selectedPasto);
    }
    
    // Filtro por idade
    if (selectedIdade !== 'all') {
      const faixa = faixasEtarias.find(f => f.value === selectedIdade);
      if (faixa) {
        filtered = filtered.filter(item => {
          const idade = parseInt(item.meses) || 0;
          return idade >= faixa.min && idade < faixa.max;
        });
      }
    }
    
    // NOVO FILTRO POR SEXO
    if (selectedSexo !== 'all') {
      filtered = filtered.filter(item => item.sexo === selectedSexo);
    }
    
    return filtered;
  };

  const getScatterData = () => {
    const filtered = getFilteredData();
    if (filtered.length === 0) return { data: [], media: 0 };
    
    const media = _.mean(filtered.map(item => item.ganho_diario));
    
    const scatterData = filtered.map((item, index) => ({
      x: index + 1,
      y: item.ganho_diario,
      animal: item.animal,
      local: item.local,
      sexo: item.sexo,
      meses: item.meses,
      acima_media: item.ganho_diario >= media
    }));
    
    return { data: scatterData, media: parseFloat(media.toFixed(4)) };
  };

  // NOVA FUNCIONALIDADE: EXPORTAÇÃO DE DADOS
  const exportToCSV = () => {
    const filtered = getFilteredData();
    if (filtered.length === 0) {
      alert('Nenhum dado para exportar');
      return;
    }

    // Preparar dados para exportação
    const csvData = filtered.map(item => ({
      'Animal': item.animal,
      'Pasto': item.local,
      'Sexo': item.sexo,
      'Idade (meses)': item.meses,
      'Ganho Diário (kg/dia)': item.ganho_diario,
      'Peso Inicial (kg)': item.peso_inicial,
      'Peso Final (kg)': item.peso_final,
      'Total de Pesagens': item.total_pesagens,
      'Status': item.ganho_diario >= getScatterData().media ? 'Acima da Média' : 'Abaixo da Média'
    }));

    // Converter para CSV
    const csv = Papa.unparse(csvData);
    
    // Criar e baixar arquivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Nome do arquivo com filtros aplicados
    let fileName = 'analise_peso_animais';
    if (selectedPasto !== 'all') fileName += `_${selectedPasto}`;
    if (selectedIdade !== 'all') fileName += `_${selectedIdade}meses`;
    if (selectedSexo !== 'all') fileName += `_${selectedSexo}`;
    fileName += '.csv';
    
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const uniqueLocals = processedData ? [...new Set(processedData.map(item => item.local))] : [];
  const uniqueSexos = processedData ? [...new Set(processedData.map(item => item.sexo))].filter(sexo => sexo !== 'N/A') : []; // NOVA FUNCIONALIDADE
  const { data: scatterData, media } = getScatterData();
  const filteredData = getFilteredData();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold">{`Animal: ${data.animal}`}</p>
          <p>{`Local: ${data.local}`}</p>
          <p>{`Sexo: ${data.sexo}`}</p>
          <p>{`Idade: ${data.meses} meses`}</p>
          <p>{`Ganho diário: ${data.y} kg/dia`}</p>
          <p className={data.acima_media ? "text-green-600" : "text-red-600"}>
            {data.acima_media ? "Acima da média" : "Abaixo da média"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="text-green-600" />
            Analisador de Ganho de Peso dos Animais - Versão Melhorada
          </CardTitle>
          <CardDescription>
            Faça upload da sua planilha para analisar o ganho de peso diário por animal, pasto, idade e sexo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-xl font-medium text-gray-600 mb-2">
                Arraste e solte sua planilha aqui
              </p>
              <p className="text-gray-500 mb-4">ou</p>
              <Button asChild>
                <label className="cursor-pointer">
                  <Upload size={20} className="mr-2" />
                  Selecionar arquivo
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </Button>
              <p className="text-sm text-gray-500 mt-4">
                Formatos suportados: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Processando dados...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {processedData && (
        <div className="space-y-6">
          {/* Filtros Melhorados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="text-gray-600" />
                Filtros Avançados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filtrar por pasto:
                  </label>
                  <Select value={selectedPasto} onValueChange={setSelectedPasto}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um pasto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os pastos</SelectItem>
                      {uniqueLocals.map(local => (
                        <SelectItem key={local} value={local}>{local}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Filtrar por idade:
                  </label>
                  <Select value={selectedIdade} onValueChange={setSelectedIdade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma faixa etária" />
                    </SelectTrigger>
                    <SelectContent>
                      {faixasEtarias.map(faixa => (
                        <SelectItem key={faixa.value} value={faixa.value}>
                          {faixa.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* NOVO FILTRO POR SEXO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="inline w-4 h-4 mr-1" />
                    Filtrar por sexo:
                  </label>
                  <Select value={selectedSexo} onValueChange={setSelectedSexo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os sexos</SelectItem>
                      {uniqueSexos.map(sexo => (
                        <SelectItem key={sexo} value={sexo}>
                          {sexo === 'M' ? 'Macho' : sexo === 'F' ? 'Fêmea' : sexo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Indicadores de filtros ativos e botão de exportação */}
              <div className="flex justify-between items-center mt-4">
                <div className="flex gap-2">
                  {selectedPasto !== 'all' && (
                    <Badge variant="secondary">
                      Pasto: {selectedPasto}
                    </Badge>
                  )}
                  {selectedIdade !== 'all' && (
                    <Badge variant="secondary">
                      Idade: {faixasEtarias.find(f => f.value === selectedIdade)?.label}
                    </Badge>
                  )}
                  {selectedSexo !== 'all' && (
                    <Badge variant="secondary">
                      Sexo: {selectedSexo === 'M' ? 'Macho' : selectedSexo === 'F' ? 'Fêmea' : selectedSexo}
                    </Badge>
                  )}
                </div>
                
                {/* BOTÃO DE EXPORTAÇÃO */}
                <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                  <Download size={16} />
                  Exportar CSV ({filteredData.length} animais)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-blue-800">Total de Animais</h3>
                <p className="text-2xl font-bold text-blue-600">{filteredData.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-green-800">Média de Ganho</h3>
                <p className="text-2xl font-bold text-green-600">{media} kg/dia</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-purple-800">Acima da Média</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredData.filter(item => item.ganho_diario >= media).length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-red-800">Abaixo da Média</h3>
                <p className="text-2xl font-bold text-red-600">
                  {filteredData.filter(item => item.ganho_diario < media).length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Dispersão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="text-blue-600" />
                Ganho de Peso Diário por Animal
                {(selectedPasto !== 'all' || selectedIdade !== 'all' || selectedSexo !== 'all') && (
                  <span className="text-sm font-normal text-gray-600">
                    - Filtrado
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Animal" 
                    domain={[0, scatterData.length + 1]}
                    label={{ value: 'Animais (ordem)', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Ganho"
                    label={{ value: 'Ganho diário (kg/dia)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  <ReferenceLine 
                    y={media} 
                    stroke="#666" 
                    strokeDasharray="5 5" 
                    label={{ value: `Média: ${media} kg/dia`, position: 'topRight' }}
                  />
                  
                  <Scatter
                    name="Acima da média"
                    data={scatterData.filter(item => item.acima_media)}
                    fill="#10b981"
                  />
                  
                  <Scatter
                    name="Abaixo da média"
                    data={scatterData.filter(item => !item.acima_media)}
                    fill="#ef4444"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela de resultados */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes por Animal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Animal</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Pasto</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Sexo</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Idade (meses)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Ganho Diário (kg/dia)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Peso Inicial (kg)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Peso Final (kg)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Total Pesagens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 font-medium">{item.animal}</td>
                        <td className="px-4 py-2">{item.local}</td>
                        <td className="px-4 py-2">
                          <Badge variant={item.sexo === 'M' ? 'default' : item.sexo === 'F' ? 'secondary' : 'outline'}>
                            {item.sexo === 'M' ? 'Macho' : item.sexo === 'F' ? 'Fêmea' : item.sexo}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{item.meses}</td>
                        <td className={`px-4 py-2 font-semibold ${item.ganho_diario >= media ? 'text-green-600' : 'text-red-600'}`}>
                          {item.ganho_diario}
                        </td>
                        <td className="px-4 py-2">{item.peso_inicial}</td>
                        <td className="px-4 py-2">{item.peso_final}</td>
                        <td className="px-4 py-2">{item.total_pesagens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AnimalWeightAnalyzer;


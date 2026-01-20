import React from 'react';

const Leaderboard = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="leaderboard-container">
        <h3>排行榜</h3>
        <p>等待数据...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h3>排行榜</h3>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>玩家</th>
            <th>胜利次数</th>
            <th>总对局</th>
            <th>总惩罚牌数</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{entry.name}</td>
              <td>{entry.wins}</td>
              <td>{entry.totalGames}</td>
              <td>{entry.totalPenalty || entry.totalCards || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;

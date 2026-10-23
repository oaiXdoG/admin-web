import type { RoleMenuResult, RoleRecord, RoleWrite } from '#/api/types';

import { requestClient } from '#/api/request';

function trimRole(data: RoleWrite): RoleWrite {
  return {
    ...data,
    code: data.code.trim(),
    description: (data.description ?? '').trim(),
    name: data.name.trim(),
  };
}

export const roleApi = {
  list: () => requestClient.post<RoleRecord[]>('/role/list', {}),
  create: (data: RoleWrite) =>
    requestClient.post<RoleRecord>('/role/create', trimRole(data)),
  update: (roleId: number, data: RoleWrite) =>
    requestClient.post<RoleRecord>('/role/update', {
      roleId,
      ...trimRole(data),
    }),
  remove: (roleId: number) =>
    requestClient.post<null>('/role/remove', { roleId }),
  menus: (roleId: number) =>
    requestClient.post<RoleMenuResult>('/role/menu/list', { roleId }),
  updateMenus: (roleId: number, menuIds: number[]) =>
    requestClient.post<null>('/role/menu/update', { menuIds, roleId }),
};

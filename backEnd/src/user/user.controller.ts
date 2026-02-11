import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * 用户控制器
 *
 * 这里的接口设计遵循非 RESTful API 风格，而是采用了更传统的 RPC (Remote Procedure Call) 风格或者说是“语义化接口”风格。
 *
 * 主要原则：
 * 1. 只使用 GET 和 POST 两种 HTTP 方法。
 *    - GET: 用于所有的数据查询操作（读取）。参数通常通过 URL 查询参数 (Query Params) 传递。
 *    - POST: 用于所有的数据变更操作（创建、更新、删除）。参数通常通过请求体 (Body) 传递。
 * 2. 接口路径 (URL) 进行语义化命名，清晰表达该接口的作用。
 *    - 例如：'create', 'list', 'info', 'update', 'delete'。
 *    - 这一点与 RESTful 不同，RESTful 通常使用同一个 URL 路径（如 /user），通过不同的 HTTP 方法来区分操作。
 */
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 创建用户
   * URL: POST /user/create
   *
   * 使用 POST 方法，因为这是在服务器上创建新资源。
   * 数据通过请求体 (@Body) 传递。
   */
  @Post('create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  /**
   * 获取用户列表
   * URL: GET /user/list
   *
   * 使用 GET 方法，因为这是一个只读操作。
   * 语义化路径 'list' 表明获取列表。
   */
  @Get('list')
  findAll() {
    return this.userService.findAll();
  }

  /**
   * 获取单个用户信息
   * URL: GET /user/info?id=1
   *
   * 使用 GET 方法，用于查询。
   * 参数 id 通过查询参数 (@Query) 传递，而不是 RESTful 风格的路径参数 (URL Param, 例如 /user/:id)。
   * 这样 URL 结构更扁平。
   */
  @Get('info')
  findOne(@Query('id') id: string) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.userService.findOne(id);
  }

  /**
   * 更新用户信息
   * URL: POST /user/update
   *
   * 使用 POST 方法，因为这是修改数据的操作。
   * 虽然 RESTful 通常使用 PATCH 或 PUT，但这里统一使用 POST。
   * id 和更新的数据都包含在请求体 (@Body) 中。
   */
  @Post('update')
  update(@Body('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.userService.update(id, updateUserDto);
  }

  /**
   * 删除用户
   * URL: POST /user/delete
   *
   * 使用 POST 方法，因为这是数据变更操作。
   * RESTful 使用 DELETE 方法，这里为了兼容性和统一性使用 POST。
   * id 通过请求体 (@Body) 传递，避免将敏感操作的参数暴露在 URL 中（虽然 delete ID 通常不敏感，但统一风格）。
   */
  @Post('delete')
  remove(@Body('id') id: string) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.userService.remove(id);
  }
}
